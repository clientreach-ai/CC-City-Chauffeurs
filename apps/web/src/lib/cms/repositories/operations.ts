import { formatMoney, todayISO } from "../format";
import { labelFor, lostReasons, bookingStatuses, enquiryStatuses } from "../status";
import { getDatabase, latency, newId, now } from "../store/database";
import type {
  ActivityEntry,
  Booking,
  BookingStatus,
  Customer,
  CustomerInput,
  CustomerSummary,
  Enquiry,
  EnquiryStatus,
  LostReason,
} from "../types";
import { assertValid, CmsNotFoundError, validator } from "../validation";

/**
 * Operations — enquiries, bookings and customers.
 *
 * Frontend foundation only. Status changes and notes are recorded here and
 * nowhere else: nothing is sent to the customer, nothing is confirmed with a
 * chauffeur, and no message leaves the admin. The screens say so beside
 * every action that a real system would one day follow through on.
 *
 * Future API: GET /enquiries, GET/PATCH /enquiries/:id,
 * POST /enquiries/:id/notes, POST /enquiries/:id/quote,
 * POST /enquiries/:id/booking, GET/PATCH /bookings/:id, GET/PATCH /customers/:id.
 */

function entry(kind: ActivityEntry["kind"], text: string): ActivityEntry {
  return { id: newId("act"), at: now(), kind, text };
}

// ------------------------------------------------------------------ enquiries

export async function getEnquiries(): Promise<Enquiry[]> {
  await latency("read");
  return getDatabase()
    .read("enquiries")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getEnquiry(id: string): Promise<Enquiry> {
  await latency("read");
  const enquiry = getDatabase()
    .read("enquiries")
    .find((item) => item.id === id);
  if (!enquiry) throw new CmsNotFoundError("This enquiry");
  return enquiry;
}

function updateEnquiryRecord(id: string, change: (enquiry: Enquiry) => void) {
  const db = getDatabase();
  let updated: Enquiry | undefined;
  db.write((draft) => {
    const enquiry = draft.enquiries.find((item) => item.id === id);
    if (!enquiry) throw new CmsNotFoundError("This enquiry");
    change(enquiry);
    enquiry.updatedAt = now();
    updated = enquiry;
  });
  return structuredClone(updated!);
}

export async function updateEnquiryStatus(
  id: string,
  status: EnquiryStatus,
  options: { lostReason?: LostReason } = {},
): Promise<Enquiry> {
  await latency("write");
  if (status === "lost" && !options.lostReason) {
    assertValid({ lostReason: "Choose why the enquiry was lost." });
  }
  return updateEnquiryRecord(id, (enquiry) => {
    enquiry.status = status;
    enquiry.lostReason = status === "lost" ? (options.lostReason ?? "other") : null;
    const label = labelFor(enquiryStatuses, status);
    enquiry.activity.push(
      entry(
        "status",
        status === "lost"
          ? `Status changed to Lost — ${labelFor(lostReasons, enquiry.lostReason)}`
          : `Status changed to ${label}`,
      ),
    );
  });
}

/**
 * Records the price agreed to be offered. Recording is all it does — the
 * quote still has to be sent to the customer by WhatsApp, phone or email.
 */
export async function recordQuote(id: string, quote: { amount: number | null; note: string }): Promise<Enquiry> {
  await latency("write");
  assertValid(
    validator()
      .required("amount", quote.amount, "Enter the amount quoted, in pounds.")
      .amount("amount", quote.amount)
      .maxLength("note", quote.note, 400)
      .result(),
  );
  return updateEnquiryRecord(id, (enquiry) => {
    enquiry.quote = { amount: quote.amount, note: quote.note.trim(), recordedAt: now() };
    if (enquiry.status === "new" || enquiry.status === "contacted") enquiry.status = "quoted";
    enquiry.activity.push(entry("quote", `Quote recorded — ${formatMoney(quote.amount)}`));
  });
}

export async function addEnquiryNote(id: string, body: string, author: string): Promise<Enquiry> {
  await latency("write");
  assertValid(
    validator().required("body", body, "Write the note first.").maxLength("body", body, 1000).result(),
  );
  return updateEnquiryRecord(id, (enquiry) => {
    enquiry.notes.push({ id: newId("note"), body: body.trim(), author, createdAt: now() });
    enquiry.activity.push(entry("note", `Note added by ${author}`));
  });
}

/** Turns a won enquiry into a pending booking carrying the same journey. */
export async function createBookingFromEnquiry(id: string): Promise<Booking> {
  await latency("write");
  const db = getDatabase();
  const enquiry = db.read("enquiries").find((item) => item.id === id);
  if (!enquiry) throw new CmsNotFoundError("This enquiry");
  if (enquiry.bookingId) throw new Error("A booking already exists for this enquiry.");
  if (!enquiry.journey.date) {
    assertValid({ date: "The enquiry has no date — add one when the booking is agreed." });
  }

  const bookings = db.read("bookings");
  const next = Math.max(2000, ...bookings.map((b) => Number(b.reference.replace(/\D/g, "")) || 0)) + 1;
  const stamp = now();
  const booking: Booking = {
    id: newId("bkg"),
    reference: `BKG-${next}`,
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
    activity: [{ id: newId("act"), at: stamp, kind: "created", text: `Booking created from ${enquiry.reference}` }],
    createdAt: stamp,
    updatedAt: stamp,
  };

  db.write((draft) => {
    draft.bookings.push(booking);
    const target = draft.enquiries.find((item) => item.id === id)!;
    target.bookingId = booking.id;
    if (target.status !== "won") {
      target.status = "won";
      target.lostReason = null;
      target.activity.push(entry("status", "Status changed to Won"));
    }
    target.activity.push(entry("booking", `Booking ${booking.reference} created`));
    target.updatedAt = stamp;
  });
  return booking;
}

// ------------------------------------------------------------------ bookings

export async function getBookings(): Promise<Booking[]> {
  await latency("read");
  return getDatabase()
    .read("bookings")
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

export async function getBooking(id: string): Promise<Booking> {
  await latency("read");
  const booking = getDatabase()
    .read("bookings")
    .find((item) => item.id === id);
  if (!booking) throw new CmsNotFoundError("This booking");
  return booking;
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<Booking> {
  await latency("write");
  let updated: Booking | undefined;
  getDatabase().write((draft) => {
    const booking = draft.bookings.find((item) => item.id === id);
    if (!booking) throw new CmsNotFoundError("This booking");
    booking.status = status;
    booking.updatedAt = now();
    booking.activity.push(entry("status", `Status changed to ${labelFor(bookingStatuses, status)}`));
    updated = booking;
  });
  return structuredClone(updated!);
}

export async function updateBookingNotes(id: string, notes: string): Promise<Booking> {
  await latency("write");
  assertValid(validator().maxLength("notes", notes, 1000).result());
  let updated: Booking | undefined;
  getDatabase().write((draft) => {
    const booking = draft.bookings.find((item) => item.id === id);
    if (!booking) throw new CmsNotFoundError("This booking");
    booking.notes = notes;
    booking.updatedAt = now();
    booking.activity.push(entry("edit", "Notes updated"));
    updated = booking;
  });
  return structuredClone(updated!);
}

// ------------------------------------------------------------------ customers

function summarise(customer: Customer, enquiries: Enquiry[], bookings: Booking[]): CustomerSummary {
  const theirs = {
    enquiries: enquiries.filter((item) => item.customerId === customer.id),
    bookings: bookings.filter((item) => item.customerId === customer.id),
  };
  const stamps = [
    customer.updatedAt,
    ...theirs.enquiries.map((item) => item.updatedAt),
    ...theirs.bookings.map((item) => item.updatedAt),
  ].sort();
  return {
    ...customer,
    enquiryCount: theirs.enquiries.length,
    bookingCount: theirs.bookings.length,
    lastActivityAt: stamps.at(-1) ?? customer.updatedAt,
  };
}

export async function getCustomers(): Promise<CustomerSummary[]> {
  await latency("read");
  const db = getDatabase();
  const enquiries = db.read("enquiries");
  const bookings = db.read("bookings");
  return db
    .read("customers")
    .map((customer) => summarise(customer, enquiries, bookings))
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

export async function getCustomer(id: string) {
  await latency("read");
  const db = getDatabase();
  const customer = db.read("customers").find((item) => item.id === id);
  if (!customer) throw new CmsNotFoundError("This customer");
  const enquiries = db
    .read("enquiries")
    .filter((item) => item.customerId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const bookings = db
    .read("bookings")
    .filter((item) => item.customerId === id)
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  return { customer: summarise(customer, enquiries, bookings), enquiries, bookings };
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  await latency("write");
  assertValid(
    validator()
      .required("name", input.name, "Add the customer's name.")
      .maxLength("name", input.name, 80)
      .phone("phone", input.phone)
      .email("email", input.email)
      .maxLength("notes", input.notes, 2000)
      .result(),
  );
  let updated: Customer | undefined;
  getDatabase().write((draft) => {
    const customer = draft.customers.find((item) => item.id === id);
    if (!customer) throw new CmsNotFoundError("This customer");
    Object.assign(customer, structuredClone(input), { updatedAt: now() });
    updated = customer;
  });
  return structuredClone(updated!);
}

// ------------------------------------------------------------------ overview

/**
 * Everything the dashboard shows, in one call — the shape of a future
 * GET /overview. Every figure is a count of real records; nothing is
 * projected, estimated or financial.
 */
export async function getOverview() {
  await latency("read");
  const db = getDatabase();
  const enquiries = db.read("enquiries").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const bookings = db.read("bookings");
  const vehicles = db.read("vehicles");
  const services = db.read("services");
  const gallery = db.read("gallery");
  const testimonials = db.read("testimonials");
  const customers = db.read("customers");
  const today = todayISO();

  const pipeline = enquiryStatuses.map((status) => ({
    ...status,
    count: enquiries.filter((item) => item.status === status.value).length,
  }));

  const liveVehicles = vehicles.filter((v) => v.status === "published");

  return {
    pipeline,
    /** Unanswered, oldest first — PRD §10.5 "what needs me right now?". */
    unanswered: enquiries
      .filter((item) => item.status === "new")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    recent: enquiries.slice(0, 6),
    upcoming: bookings
      .filter((item) => item.date >= today && item.status !== "cancelled" && item.status !== "completed")
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
      .slice(0, 6),
    customers,
    vehicles,
    content: {
      vehicles: {
        published: liveVehicles.length,
        draft: vehicles.filter((v) => v.status === "draft").length,
        archived: vehicles.filter((v) => v.status === "archived").length,
      },
      services: {
        published: services.filter((s) => s.status === "published").length,
        draft: services.filter((s) => s.status === "draft").length,
      },
      gallery: {
        published: gallery.filter((g) => g.status === "published").length,
        hidden: gallery.filter((g) => g.status === "draft").length,
      },
      testimonials: {
        published: testimonials.filter((t) => t.status === "published").length,
        pending: testimonials.filter((t) => t.status === "draft").length,
      },
    },
    /** Gaps in the published fleet that only the client can fill. */
    gaps: {
      photography: liveVehicles.filter((v) => !v.images.main).map((v) => ({ id: v.id, name: v.name })),
      capacity: liveVehicles
        .filter((v) => v.specs.passengers == null)
        .map((v) => ({ id: v.id, name: v.name })),
      ownership: liveVehicles.filter((v) => v.ownership === "unconfirmed").length,
      pricing: liveVehicles.filter((v) => v.pricing.hourlyRate == null).length,
    },
  };
}

export type Overview = Awaited<ReturnType<typeof getOverview>>;
