import {
  assertValid,
  bookingStatuses,
  CmsNotFoundError,
  enquiryStatuses,
  formatMoney,
  labelFor,
  lostReasons,
  todayISO,
  validator,
  type ActivityEntry,
  type Booking,
  type BookingStatus,
  type Customer,
  type CustomerInput,
  type CustomerSummary,
  type Enquiry,
  type EnquiryStatus,
  type LostReason,
  type Note,
} from "@CC-City-Chauffeurs/core";
import { db, schema } from "@CC-City-Chauffeurs/db";
import { asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { ConflictError } from "../lib/errors";
import { iso, newId } from "../lib/ids";
import type { PublicEnquiryInput } from "@CC-City-Chauffeurs/core/schemas";

/**
 * Operations — enquiries, the bookings they become, and the customers behind
 * both.
 *
 * Recording is all this does. A status change, a note or a quote is written
 * here and nowhere else: nothing is sent to the customer, nothing is
 * confirmed with a chauffeur, and no message leaves the admin. Every screen
 * that offers one of these actions says so.
 *
 * Routes: GET /enquiries, GET/PATCH /enquiries/:id, POST /enquiries/:id/notes,
 * POST /enquiries/:id/quote, POST /enquiries/:id/booking,
 * GET/PATCH /bookings/:id, GET/PATCH /customers/:id, GET /overview.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ------------------------------------------------------------------ mapping

type EnquiryRow = typeof schema.enquiry.$inferSelect;
type BookingRow = typeof schema.booking.$inferSelect;
type CustomerRow = typeof schema.customer.$inferSelect;
type ActivityRow = typeof schema.activityEntry.$inferSelect;
type NoteRow = typeof schema.enquiryNote.$inferSelect;

function toActivity(row: ActivityRow): ActivityEntry {
  return { id: row.id, at: iso(row.at), kind: row.kind, text: row.text };
}

function toNote(row: NoteRow): Note {
  return { id: row.id, body: row.body, author: row.author, createdAt: iso(row.createdAt) };
}

function toEnquiry(row: EnquiryRow, notes: Note[], activity: ActivityEntry[]): Enquiry {
  return {
    id: row.id,
    reference: row.reference,
    customerId: row.customerId,
    contact: row.contact,
    source: row.source,
    replyBy: row.replyBy,
    journey: row.journey,
    message: row.message,
    status: row.status,
    lostReason: row.lostReason ?? null,
    quote: row.quote ?? null,
    notes,
    activity,
    bookingId: row.bookingId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function toBooking(row: BookingRow, activity: ActivityEntry[]): Booking {
  return {
    id: row.id,
    reference: row.reference,
    customerId: row.customerId,
    enquiryId: row.enquiryId,
    service: row.service,
    vehicleId: row.vehicleId,
    date: row.date,
    time: row.time,
    pickup: row.pickup,
    destination: row.destination,
    passengers: row.passengers,
    notes: row.notes,
    status: row.status,
    activity,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    company: row.company,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

/** Notes and activity for a set of enquiries, in one pass each. */
async function enquiryChildren(ids: string[]) {
  if (!ids.length) return { notes: () => [], activity: () => [] };
  const [notes, activity] = await Promise.all([
    db
      .select()
      .from(schema.enquiryNote)
      .where(inArray(schema.enquiryNote.enquiryId, ids))
      .orderBy(asc(schema.enquiryNote.createdAt)),
    db
      .select()
      .from(schema.activityEntry)
      .where(inArray(schema.activityEntry.enquiryId, ids))
      .orderBy(asc(schema.activityEntry.at)),
  ]);

  const noteIndex = new Map<string, Note[]>();
  for (const row of notes) {
    const list = noteIndex.get(row.enquiryId) ?? [];
    list.push(toNote(row));
    noteIndex.set(row.enquiryId, list);
  }
  const activityIndex = new Map<string, ActivityEntry[]>();
  for (const row of activity) {
    if (!row.enquiryId) continue;
    const list = activityIndex.get(row.enquiryId) ?? [];
    list.push(toActivity(row));
    activityIndex.set(row.enquiryId, list);
  }
  return {
    notes: (id: string) => noteIndex.get(id) ?? [],
    activity: (id: string) => activityIndex.get(id) ?? [],
  };
}

async function bookingActivity(ids: string[]) {
  if (!ids.length) return () => [];
  const rows = await db
    .select()
    .from(schema.activityEntry)
    .where(inArray(schema.activityEntry.bookingId, ids))
    .orderBy(asc(schema.activityEntry.at));
  const index = new Map<string, ActivityEntry[]>();
  for (const row of rows) {
    if (!row.bookingId) continue;
    const list = index.get(row.bookingId) ?? [];
    list.push(toActivity(row));
    index.set(row.bookingId, list);
  }
  return (id: string) => index.get(id) ?? [];
}

async function log(tx: Tx, parent: { enquiryId?: string; bookingId?: string }, kind: ActivityEntry["kind"], text: string) {
  await tx.insert(schema.activityEntry).values({
    id: newId("act"),
    enquiryId: parent.enquiryId ?? null,
    bookingId: parent.bookingId ?? null,
    kind,
    text,
  });
}

// ------------------------------------------------------------------ enquiries

export async function getEnquiries(): Promise<Enquiry[]> {
  const rows = await db.select().from(schema.enquiry).orderBy(desc(schema.enquiry.createdAt));
  const children = await enquiryChildren(rows.map((row) => row.id));
  return rows.map((row) => toEnquiry(row, children.notes(row.id), children.activity(row.id)));
}

export async function getEnquiry(id: string): Promise<Enquiry> {
  const [row] = await db.select().from(schema.enquiry).where(eq(schema.enquiry.id, id)).limit(1);
  if (!row) throw new CmsNotFoundError("This enquiry");
  const children = await enquiryChildren([id]);
  return toEnquiry(row, children.notes(id), children.activity(id));
}

export async function updateEnquiryStatus(
  id: string,
  status: EnquiryStatus,
  options: { lostReason?: LostReason } = {},
): Promise<Enquiry> {
  if (status === "lost" && !options.lostReason) {
    assertValid({ lostReason: "Choose why the enquiry was lost." });
  }

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(schema.enquiry)
      .where(eq(schema.enquiry.id, id))
      .limit(1);
    if (!current) throw new CmsNotFoundError("This enquiry");

    const lostReason = status === "lost" ? (options.lostReason ?? "other") : null;
    await tx
      .update(schema.enquiry)
      .set({ status, lostReason, updatedAt: new Date() })
      .where(eq(schema.enquiry.id, id));

    await log(
      tx,
      { enquiryId: id },
      "status",
      status === "lost"
        ? `Status changed to Lost — ${labelFor(lostReasons, lostReason)}`
        : `Status changed to ${labelFor(enquiryStatuses, status)}`,
    );
  });

  return getEnquiry(id);
}

/**
 * Records the price agreed to be offered. Recording is all it does — the
 * quote still has to be sent to the customer by WhatsApp, phone or email.
 */
export async function recordQuote(
  id: string,
  quote: { amount: number | null; note: string },
): Promise<Enquiry> {
  assertValid(
    validator()
      .required("amount", quote.amount, "Enter the amount quoted, in pounds.")
      .amount("amount", quote.amount)
      .maxLength("note", quote.note, 400)
      .result(),
  );

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(schema.enquiry)
      .where(eq(schema.enquiry.id, id))
      .limit(1);
    if (!current) throw new CmsNotFoundError("This enquiry");

    const advanced = current.status === "new" || current.status === "contacted";
    await tx
      .update(schema.enquiry)
      .set({
        quote: { amount: quote.amount, note: quote.note.trim(), recordedAt: new Date().toISOString() },
        status: advanced ? "quoted" : current.status,
        updatedAt: new Date(),
      })
      .where(eq(schema.enquiry.id, id));

    await log(tx, { enquiryId: id }, "quote", `Quote recorded — ${formatMoney(quote.amount)}`);
  });

  return getEnquiry(id);
}

export async function addEnquiryNote(id: string, body: string, author: string): Promise<Enquiry> {
  assertValid(
    validator().required("body", body, "Write the note first.").maxLength("body", body, 1000).result(),
  );

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(schema.enquiry)
      .where(eq(schema.enquiry.id, id))
      .limit(1);
    if (!current) throw new CmsNotFoundError("This enquiry");

    await tx
      .insert(schema.enquiryNote)
      .values({ id: newId("note"), enquiryId: id, body: body.trim(), author });
    await tx.update(schema.enquiry).set({ updatedAt: new Date() }).where(eq(schema.enquiry.id, id));
    await log(tx, { enquiryId: id }, "note", `Note added by ${author}`);
  });

  return getEnquiry(id);
}

/** The next free reference in a series, e.g. BKG-2001. */
async function nextReference(tx: Tx, prefix: string, floor: number) {
  const table = prefix === "BKG" ? schema.booking : schema.enquiry;
  const rows = await tx.select({ reference: table.reference }).from(table);
  const highest = rows.reduce((top, row) => {
    const digits = Number(row.reference.replace(/\D/g, ""));
    return Number.isFinite(digits) && digits > top ? digits : top;
  }, floor);
  return `${prefix}-${highest + 1}`;
}

/** Turns a won enquiry into a pending booking carrying the same journey. */
export async function createBookingFromEnquiry(id: string): Promise<Booking> {
  let bookingId = "";

  await db.transaction(async (tx) => {
    const [enquiry] = await tx.select().from(schema.enquiry).where(eq(schema.enquiry.id, id)).limit(1);
    if (!enquiry) throw new CmsNotFoundError("This enquiry");
    if (enquiry.bookingId) throw new ConflictError("A booking already exists for this enquiry.");
    if (!enquiry.journey.date) {
      assertValid({ date: "The enquiry has no date — add one when the booking is agreed." });
    }

    bookingId = newId("bkg");
    const reference = await nextReference(tx, "BKG", 2000);

    await tx.insert(schema.booking).values({
      id: bookingId,
      reference,
      customerId: enquiry.customerId,
      enquiryId: enquiry.id,
      service: enquiry.journey.service,
      vehicleId: enquiry.journey.vehicleId,
      date: enquiry.journey.date,
      time: enquiry.journey.time,
      pickup: enquiry.journey.pickup,
      destination: enquiry.journey.dropoff,
      passengers: enquiry.journey.passengers,
      notes: enquiry.message,
      status: "pending",
    });
    await log(tx, { bookingId }, "created", `Booking created from ${enquiry.reference}`);

    const won = enquiry.status === "won";
    await tx
      .update(schema.enquiry)
      .set({
        bookingId,
        status: "won",
        lostReason: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.enquiry.id, id));

    if (!won) await log(tx, { enquiryId: id }, "status", "Status changed to Won");
    await log(tx, { enquiryId: id }, "booking", `Booking ${reference} created`);
  });

  return getBooking(bookingId);
}

/**
 * Records an enquiry sent from the public website.
 *
 * The customer is matched on email, then phone, so a returning client builds
 * one history rather than a new record each time.
 */
export async function createPublicEnquiry(input: PublicEnquiryInput): Promise<Enquiry> {
  const id = newId("enq");

  await db.transaction(async (tx) => {
    let customerId: string | null = null;
    const email = input.email.trim().toLowerCase();
    const phone = input.phone.replace(/\D/g, "");

    if (email || phone) {
      const candidates = await tx.select().from(schema.customer);
      const match = candidates.find(
        (row) =>
          (email && row.email.trim().toLowerCase() === email) ||
          (phone && row.phone.replace(/\D/g, "") === phone),
      );
      if (match) {
        customerId = match.id;
      } else {
        customerId = newId("cus");
        await tx.insert(schema.customer).values({
          id: customerId,
          name: input.name,
          type: "private",
          company: "",
          phone: input.phone,
          email: input.email,
          notes: "",
        });
      }
    }

    const reference = await nextReference(tx, "ENQ", 1000);
    await tx.insert(schema.enquiry).values({
      id,
      reference,
      customerId,
      contact: { name: input.name, phone: input.phone, email: input.email },
      source: "website",
      replyBy: input.replyBy,
      journey: {
        service: input.service,
        vehicleId: input.vehicleId,
        pickup: input.pickup,
        dropoff: input.dropoff,
        date: input.date,
        time: input.time,
        passengers: input.passengers,
        luggage: input.luggage,
        flight: input.flight,
      },
      message: input.message,
      status: "new",
    });
    await log(tx, { enquiryId: id }, "created", `Enquiry ${reference} received from the website`);
  });

  return getEnquiry(id);
}

// ------------------------------------------------------------------ bookings

export async function getBookings(): Promise<Booking[]> {
  const rows = await db
    .select()
    .from(schema.booking)
    .orderBy(asc(schema.booking.date), asc(schema.booking.time));
  const activity = await bookingActivity(rows.map((row) => row.id));
  return rows.map((row) => toBooking(row, activity(row.id)));
}

export async function getBooking(id: string): Promise<Booking> {
  const [row] = await db.select().from(schema.booking).where(eq(schema.booking.id, id)).limit(1);
  if (!row) throw new CmsNotFoundError("This booking");
  const activity = await bookingActivity([id]);
  return toBooking(row, activity(id));
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<Booking> {
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(schema.booking).where(eq(schema.booking.id, id)).limit(1);
    if (!current) throw new CmsNotFoundError("This booking");
    await tx
      .update(schema.booking)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.booking.id, id));
    await log(tx, { bookingId: id }, "status", `Status changed to ${labelFor(bookingStatuses, status)}`);
  });
  return getBooking(id);
}

export async function updateBookingNotes(id: string, notes: string): Promise<Booking> {
  assertValid(validator().maxLength("notes", notes, 1000).result());
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(schema.booking).where(eq(schema.booking.id, id)).limit(1);
    if (!current) throw new CmsNotFoundError("This booking");
    await tx
      .update(schema.booking)
      .set({ notes, updatedAt: new Date() })
      .where(eq(schema.booking.id, id));
    await log(tx, { bookingId: id }, "edit", "Notes updated");
  });
  return getBooking(id);
}

// ------------------------------------------------------------------ customers

function summarise(
  customer: Customer,
  counts: { enquiries: number; bookings: number; lastActivityAt: string },
): CustomerSummary {
  return {
    ...customer,
    enquiryCount: counts.enquiries,
    bookingCount: counts.bookings,
    lastActivityAt: counts.lastActivityAt || customer.updatedAt,
  };
}

export async function getCustomers(): Promise<CustomerSummary[]> {
  const [customers, enquiryCounts, bookingCounts] = await Promise.all([
    db.select().from(schema.customer),
    db
      .select({
        customerId: schema.enquiry.customerId,
        count: sql<number>`count(*)`,
        latest: sql<Date>`max(${schema.enquiry.updatedAt})`,
      })
      .from(schema.enquiry)
      .where(isNotNull(schema.enquiry.customerId))
      .groupBy(schema.enquiry.customerId),
    db
      .select({
        customerId: schema.booking.customerId,
        count: sql<number>`count(*)`,
        latest: sql<Date>`max(${schema.booking.updatedAt})`,
      })
      .from(schema.booking)
      .where(isNotNull(schema.booking.customerId))
      .groupBy(schema.booking.customerId),
  ]);

  const enquiryIndex = new Map(enquiryCounts.map((row) => [row.customerId!, row]));
  const bookingIndex = new Map(bookingCounts.map((row) => [row.customerId!, row]));

  return customers
    .map((row) => {
      const customer = toCustomer(row);
      const enquiries = enquiryIndex.get(row.id);
      const bookings = bookingIndex.get(row.id);
      const stamps = [customer.updatedAt, iso(enquiries?.latest), iso(bookings?.latest)]
        .filter(Boolean)
        .sort();
      return summarise(customer, {
        enquiries: Number(enquiries?.count ?? 0),
        bookings: Number(bookings?.count ?? 0),
        lastActivityAt: stamps.at(-1) ?? customer.updatedAt,
      });
    })
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

export async function getCustomer(id: string) {
  const [row] = await db.select().from(schema.customer).where(eq(schema.customer.id, id)).limit(1);
  if (!row) throw new CmsNotFoundError("This customer");

  const [enquiryRows, bookingRows] = await Promise.all([
    db
      .select()
      .from(schema.enquiry)
      .where(eq(schema.enquiry.customerId, id))
      .orderBy(desc(schema.enquiry.createdAt)),
    db
      .select()
      .from(schema.booking)
      .where(eq(schema.booking.customerId, id))
      .orderBy(desc(schema.booking.date), desc(schema.booking.time)),
  ]);

  const children = await enquiryChildren(enquiryRows.map((item) => item.id));
  const activity = await bookingActivity(bookingRows.map((item) => item.id));

  const enquiries = enquiryRows.map((item) =>
    toEnquiry(item, children.notes(item.id), children.activity(item.id)),
  );
  const bookings = bookingRows.map((item) => toBooking(item, activity(item.id)));

  const customer = toCustomer(row);
  const stamps = [
    customer.updatedAt,
    ...enquiries.map((item) => item.updatedAt),
    ...bookings.map((item) => item.updatedAt),
  ].sort();

  return {
    customer: summarise(customer, {
      enquiries: enquiries.length,
      bookings: bookings.length,
      lastActivityAt: stamps.at(-1) ?? customer.updatedAt,
    }),
    enquiries,
    bookings,
  };
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  assertValid(
    validator()
      .required("name", input.name, "Add the customer's name.")
      .maxLength("name", input.name, 80)
      .phone("phone", input.phone)
      .email("email", input.email)
      .maxLength("notes", input.notes, 2000)
      .result(),
  );

  const [current] = await db.select().from(schema.customer).where(eq(schema.customer.id, id)).limit(1);
  if (!current) throw new CmsNotFoundError("This customer");

  await db
    .update(schema.customer)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.customer.id, id));

  const [row] = await db.select().from(schema.customer).where(eq(schema.customer.id, id)).limit(1);
  return toCustomer(row!);
}

// ------------------------------------------------------------------ overview

/**
 * Everything the dashboard shows, in one call. Every figure is a count of
 * real records; nothing is projected, estimated or financial.
 */
export async function getOverview() {
  const [enquiries, bookings, vehicles, services, gallery, testimonials, customers] =
    await Promise.all([
      db.select().from(schema.enquiry).orderBy(desc(schema.enquiry.createdAt)),
      db.select().from(schema.booking),
      db.select().from(schema.vehicle),
      db.select({ status: schema.service.status }).from(schema.service),
      db.select({ status: schema.galleryItem.status }).from(schema.galleryItem),
      db.select({ status: schema.testimonial.status }).from(schema.testimonial),
      getCustomers(),
    ]);

  const today = todayISO();
  const children = await enquiryChildren(enquiries.map((row) => row.id));
  const asEnquiry = (row: EnquiryRow) =>
    toEnquiry(row, children.notes(row.id), children.activity(row.id));

  const bookingActivityFor = await bookingActivity(bookings.map((row) => row.id));

  const liveVehicles = vehicles.filter((item) => item.status === "published");
  const count = <T extends { status: string }>(rows: T[], status: string) =>
    rows.filter((row) => row.status === status).length;

  return {
    pipeline: enquiryStatuses.map((status) => ({
      ...status,
      count: enquiries.filter((item) => item.status === status.value).length,
    })),
    /** Unanswered, oldest first — "what needs me right now?". */
    unanswered: enquiries
      .filter((item) => item.status === "new")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(asEnquiry),
    recent: enquiries.slice(0, 6).map(asEnquiry),
    upcoming: bookings
      .filter(
        (item) => item.date >= today && item.status !== "cancelled" && item.status !== "completed",
      )
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
      .slice(0, 6)
      .map((item) => toBooking(item, bookingActivityFor(item.id))),
    customers,
    vehicles: vehicles.map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      images: item.images,
      specs: item.specs,
      pricing: item.pricing,
      ownership: item.ownership,
    })),
    content: {
      vehicles: {
        published: liveVehicles.length,
        draft: count(vehicles, "draft"),
        archived: count(vehicles, "archived"),
      },
      services: { published: count(services, "published"), draft: count(services, "draft") },
      gallery: { published: count(gallery, "published"), hidden: count(gallery, "draft") },
      testimonials: {
        published: count(testimonials, "published"),
        pending: count(testimonials, "draft"),
      },
    },
    /** Gaps in the published fleet that only the client can fill. */
    gaps: {
      photography: liveVehicles
        .filter((item) => !item.images.main)
        .map((item) => ({ id: item.id, name: item.name })),
      capacity: liveVehicles
        .filter((item) => item.specs.passengers == null)
        .map((item) => ({ id: item.id, name: item.name })),
      ownership: liveVehicles.filter((item) => item.ownership === "unconfirmed").length,
      pricing: liveVehicles.filter((item) => item.pricing.hourlyRate == null).length,
    },
  };
}

export type Overview = Awaited<ReturnType<typeof getOverview>>;
