import {
  assertValid,
  bookingStatuses,
  CmsNotFoundError,
  enquiryStatuses,
  DEFAULT_MAX_MONTHS_AHEAD,
  DEFAULT_SERVED_COUNTRIES,
  DEFAULT_SERVED_PLACES,
  formatDate,
  formatMoney,
  journeyDateRefusal,
  journeyHasPassed,
  labelFor,
  locationRefusal,
  londonClock,
  londonDateIn,
  londonToday,
  lostReasons,
  todayISO,
  validator,
  type ActivityEntry,
  type Booking,
  type BookingStatus,
  type Coverage,
  type Customer,
  type CustomerInput,
  type CustomerSummary,
  type Enquiry,
  type EnquirySource,
  type EnquiryStatus,
  type FieldErrors,
  type LostReason,
  type Note,
} from "@CC-City-Chauffeurs/core";
import { db, schema } from "@CC-City-Chauffeurs/db";
import { tryNormalisePhone } from "@CC-City-Chauffeurs/whatsapp/phone";
import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";

import { ConflictError } from "../lib/errors";
import { iso, newId } from "../lib/ids";
import { getSettings } from "./content";
import {
  enquiryJourneyPatchSchema,
  type BookingInput,
  type EnquiryJourneyPatch,
  type PublicEnquiryInput,
} from "@CC-City-Chauffeurs/core/schemas";

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
    // The assistant's own requests carry `wa:<message>:booking`; everything
    // else with no enquiry behind it was typed by the office.
    origin: row.enquiryId ? "enquiry" : row.submissionId?.startsWith("wa:") ? "whatsapp" : "office",
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
  if (status === "cancelled") return cancelEnquiry(id, "office");
  // Expiry is something that happened, not something anybody decides. The
  // sweep in `expireDueEnquiries` is the only thing that sets it, so a
  // request to set it by hand is refused rather than quietly accepted — an
  // enquiry whose date is still ahead of us would otherwise read as finished.
  if (status === "expired") {
    assertValid({ status: "An enquiry expires on its own when its date passes. Mark it lost or cancelled instead." });
  }
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
 * Statuses an enquiry cannot be amended or cancelled out of, in words the
 * caller can pass on.
 *
 * `won` and anything already turned into a booking are commitments the
 * office has made with the customer, and a reschedule would have to move the
 * booking too. `cancelled` is finished. `lost` is finished, and quietly
 * reopening it by amendment would hide from the office that the customer
 * came back. `expired` is the same: the journey it asked for has been and
 * gone, so a customer wanting that trip after all is asking for a new one,
 * and the office should hear about it rather than find the old record
 * silently moved into next month.
 */
export function settledReason(enquiry: { status: EnquiryStatus; bookingId: string | null }) {
  if (enquiry.bookingId) return "This enquiry has already become a booking, so the office has to make the change.";
  if (enquiry.status === "won") return "The office has already agreed this one, so they have to make the change.";
  if (enquiry.status === "cancelled") return "This enquiry has already been cancelled.";
  if (enquiry.status === "lost") return "This enquiry was closed, so the office has to reopen it.";
  if (enquiry.status === "expired") return "The date on this enquiry has passed, so the team has to reopen it.";
  return null;
}

/** "the date, the time and the pick-up", for the trail the office reads. */
const listed = (parts: string[]) =>
  parts.length < 2 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;

const FIELD_NAMES: Record<keyof EnquiryJourneyPatch, string> = {
  service: "service",
  vehicleId: "vehicle",
  pickup: "pick-up",
  dropoff: "destination",
  date: "date",
  time: "time",
  passengers: "passenger count",
  luggage: "luggage",
  flight: "flight",
  message: "note",
};

/**
 * Where we drive and how far ahead, read once.
 *
 * Exported because the assistant needs the same answer: it refuses a journey
 * mid-conversation and the server refuses it again when the enquiry is
 * recorded, and two layers reading the settings separately is two places for
 * them to drift apart.
 *
 * A settings row that is missing entirely is a configuration fault, and a
 * customer's enquiry must not be lost to one — nor, worse, be waved through
 * because the rule could not be read. The rule still applies, from the same
 * defaults the seed would have written.
 */
export async function journeyRules(): Promise<{ coverage: Coverage; maxMonthsAhead: number }> {
  const settings = await getSettings().catch((error: unknown) => {
    if (error instanceof CmsNotFoundError) return null;
    throw error;
  });

  return {
    coverage: {
      serviceAreas: settings?.business.serviceAreas ?? [],
      servedPlaces: settings?.business.servedPlaces ?? [...DEFAULT_SERVED_PLACES],
      servedCountries: settings?.business.servedCountries ?? [...DEFAULT_SERVED_COUNTRIES],
    },
    maxMonthsAhead: settings?.booking.maxMonthsAhead ?? DEFAULT_MAX_MONTHS_AHEAD,
  };
}

/**
 * The journey rules the settings own, applied wherever a customer's journey
 * arrives: the website's form, the assistant on WhatsApp, and a customer
 * amending what they already asked for.
 *
 * A static schema cannot do this. Where we drive and how far ahead we take
 * work are figures the client edits in the admin, so the check has to happen
 * where settings can be read — which is here, not in Zod.
 *
 * Deliberately not applied to anything the office does. `createBooking` and
 * an amendment the office makes record what the business has actually
 * agreed, and software telling the office it may not drive somewhere would
 * be wrong about who decides.
 */
async function assertJourneyIsOneWeTake(journey: {
  pickup?: string | undefined;
  dropoff?: string | undefined;
  date?: string | undefined;
}) {
  const { coverage, maxMonthsAhead } = await journeyRules();

  const errors: FieldErrors = {};
  for (const field of ["pickup", "dropoff"] as const) {
    const said = journey[field];
    if (!said) continue;
    const refusal = locationRefusal(said, coverage);
    if (refusal) errors[field] = refusal;
  }

  if (journey.date) {
    const refusal = journeyDateRefusal(journey.date, {
      today: londonToday(),
      maxMonthsAhead,
      // The same one day the website's own schema allows, because "today"
      // for a visitor abroad can be yesterday here. Keeping the tolerance
      // identical is what stops the two layers refusing different dates.
      graceDays: 1,
    });
    if (refusal) errors.date = refusal;
  }

  assertValid(errors);
}

/**
 * Amend the journey on an enquiry.
 *
 * One capability, two doors: the office amending an enquiry in the admin and
 * a customer rescheduling their own on WhatsApp arrive here. Only the fields
 * in the patch move; everything else is left exactly as it was, because a
 * customer saying "make it Friday" has said nothing about their luggage.
 *
 * Whoever is calling has already decided they are allowed to. This decides
 * whether the enquiry can take the change at all.
 */
export async function updateEnquiryJourney(
  id: string,
  patch: EnquiryJourneyPatch,
  { by = "office" }: { by?: "customer" | "office" } = {},
): Promise<Enquiry> {
  const { message, ...clean } = enquiryJourneyPatchSchema.parse(patch);
  if (by === "customer") await assertJourneyIsOneWeTake(clean);

  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(schema.enquiry).where(eq(schema.enquiry.id, id)).limit(1);
    if (!current) throw new CmsNotFoundError("This enquiry");

    const blocked = settledReason({ status: current.status, bookingId: current.bookingId });
    if (blocked) assertValid({ status: blocked });

    // A car that is not in the fleet is refused rather than dropped: unlike a
    // new enquiry, there is an existing value here and silently keeping it
    // would read as though the change had been made.
    if (clean.vehicleId && !(await vehicleExists(tx, clean.vehicleId))) {
      assertValid({ vehicleId: "That vehicle is not in the fleet." });
    }

    const journey = { ...current.journey };
    const changed: string[] = [];
    for (const [field, value] of Object.entries(clean) as [keyof typeof clean, never][]) {
      if (value === undefined) continue;
      if (journey[field] === value) continue;
      journey[field] = value;
      changed.push(FIELD_NAMES[field]);
    }
    if (message !== undefined && message !== current.message) changed.push(FIELD_NAMES.message);

    if (!changed.length) return;

    await tx
      .update(schema.enquiry)
      .set({
        journey,
        ...(message === undefined ? {} : { message }),
        updatedAt: new Date(),
      })
      .where(eq(schema.enquiry.id, id));

    await log(tx, { enquiryId: id }, "edit", `Journey amended: ${listed(changed)}`);
  });

  return getEnquiry(id);
}

/**
 * The customer has withdrawn.
 *
 * Its own status rather than Lost, so the office can see the difference
 * between business it did not win and business nobody competed for, and so
 * the conversion figure is not dragged down by a change of mind.
 *
 * It is always the customer who withdraws; `via` is only where it was
 * recorded. The office records it when the customer rang or wrote to say so,
 * and the trail says that rather than suggesting the office called it off.
 */
export async function cancelEnquiry(id: string, via: "whatsapp" | "office" = "office"): Promise<Enquiry> {
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(schema.enquiry).where(eq(schema.enquiry.id, id)).limit(1);
    if (!current) throw new CmsNotFoundError("This enquiry");

    const blocked = settledReason({ status: current.status, bookingId: current.bookingId });
    if (blocked) assertValid({ status: blocked });

    await tx
      .update(schema.enquiry)
      .set({ status: "cancelled", lostReason: null, updatedAt: new Date() })
      .where(eq(schema.enquiry.id, id));

    await log(
      tx,
      { enquiryId: id },
      "status",
      via === "whatsapp" ? "Cancelled by the customer on WhatsApp" : "Cancelled by the customer, recorded by the office",
    );
  });

  return getEnquiry(id);
}

/**
 * Statuses an enquiry can expire out of.
 *
 * Everything still being worked, and nothing else. `won` is deliberately
 * absent: a won enquiry whose date has passed with no booking behind it is a
 * real problem somebody needs to see, and sweeping it into Expired would
 * hide exactly the thing worth looking at. `lost`, `cancelled` and `expired`
 * are already finished.
 */
const EXPIRABLE = ["new", "contacted", "quoted"] as const satisfies readonly EnquiryStatus[];

/**
 * The lock the sweep holds while it runs.
 *
 * An arbitrary number, the same one every time, so that two sweeps — the
 * hourly timer and somebody running the script by hand — queue instead of
 * working the same rows at once. Taken for the transaction, so it is
 * released by the commit or the rollback and never by anything remembering
 * to.
 */
const EXPIRY_LOCK = 48_201_911;

/**
 * How many days ahead of a journey the customer hears from us.
 *
 * Two, because the client's own published figure is "48 hours' notice
 * wherever possible": a reply still leaves enough time to put a car to it.
 * Earlier and the customer may not have decided; later and a yes is no use.
 */
const REMIND_DAYS_AHEAD = 2;

/**
 * The hours a reminder may leave, in London.
 *
 * The timer is hourly and unattended, so without this a reminder lands at
 * four in the morning, which is not how a chauffeur company writes to
 * anybody. Outside these hours the sweep does nothing at all and the next
 * run inside them picks the same enquiries up.
 */
const REMIND_FROM = "08:00";
const REMIND_UNTIL = "20:00";

/** An enquiry whose customer is due to hear from us, and what to say it about. */
export type DueReminder = {
  id: string;
  reference: string;
  name: string;
  email: string;
  date: string;
  time: string;
};

export type ExpiredEnquiry = { id: string; reference: string; date: string; time: string };

/**
 * Writes to the customers whose journey is nearly here and who have not
 * booked, once each.
 *
 * The sweep below closes these enquiries once the day has gone; this is the
 * message that gives them a chance not to be closed. It is the only thing in
 * the system that writes to a customer nobody has just heard from, so the
 * conditions are narrow on purpose: still being worked, nothing booked, the
 * journey ahead of us but inside `REMIND_DAYS_AHEAD`, an email address to
 * write to, inside the hours a company writes to people, and never twice.
 *
 * Claimed before sent, not after. The `reminded` line goes on the trail in a
 * transaction that commits before a single email leaves, so two sweeps at
 * once cannot both write to the same customer. The cost of that order is the
 * rarer failure: a crash between the commit and the send would leave a line
 * saying we wrote to somebody we did not. Two reminders are worse than none,
 * so that is the way round to have it.
 *
 * `send` is given by the caller rather than imported, because a repository
 * that can send email is a repository that sends email from a test.
 */
export async function remindDueEnquiries(
  options: {
    now?: Date;
    dryRun?: boolean;
    send?: (reminder: DueReminder) => Promise<boolean>;
  } = {},
): Promise<{ inWindow: boolean; checked: number; reminded: DueReminder[]; unsent: DueReminder[] }> {
  const now = options.now ?? new Date();
  const clock = londonClock(now);
  if (clock < REMIND_FROM || clock >= REMIND_UNTIL) {
    return { inWindow: false, checked: 0, reminded: [], unsent: [] };
  }

  const today = londonToday(now);
  const until = londonDateIn(REMIND_DAYS_AHEAD, now);

  const candidates = await db
    .select({
      id: schema.enquiry.id,
      reference: schema.enquiry.reference,
      contact: schema.enquiry.contact,
      journey: schema.enquiry.journey,
    })
    .from(schema.enquiry)
    .where(
      and(
        inArray(schema.enquiry.status, [...EXPIRABLE]),
        isNull(schema.enquiry.bookingId),
        sql`${schema.enquiry.journey} ->> 'date' >= ${today}`,
        sql`${schema.enquiry.journey} ->> 'date' <= ${until}`,
        sql`coalesce(${schema.enquiry.contact} ->> 'email', '') <> ''`,
        sql`not exists (
          select 1 from ${schema.activityEntry}
           where ${schema.activityEntry.enquiryId} = ${schema.enquiry.id}
             and ${schema.activityEntry.kind} = 'reminded'
        )`,
      ),
    )
    .orderBy(asc(sql`${schema.enquiry.journey} ->> 'date'`));

  const reminded: DueReminder[] = [];
  const unsent: DueReminder[] = [];

  for (const row of candidates) {
    // A journey timed for earlier today has been and gone: the sweep below is
    // about to close it, and telling somebody their car is nearly here would
    // be the last thing we ever said to them about it.
    if (journeyHasPassed(row.journey, now)) continue;

    const due: DueReminder = {
      id: row.id,
      reference: row.reference,
      name: row.contact.name,
      email: row.contact.email,
      date: row.journey.date,
      time: row.journey.time,
    };
    if (options.dryRun) {
      reminded.push(due);
      continue;
    }

    const claimed = await db.transaction(async (tx) => {
      const [still] = await tx
        .select({ id: schema.enquiry.id })
        .from(schema.enquiry)
        .where(
          and(
            eq(schema.enquiry.id, row.id),
            inArray(schema.enquiry.status, [...EXPIRABLE]),
            isNull(schema.enquiry.bookingId),
            sql`not exists (
              select 1 from ${schema.activityEntry}
               where ${schema.activityEntry.enquiryId} = ${schema.enquiry.id}
                 and ${schema.activityEntry.kind} = 'reminded'
            )`,
          ),
        );
      if (!still) return false;
      await log(
        tx,
        { enquiryId: row.id },
        "reminded",
        `Reminder emailed to ${due.email} — the journey is on ${formatDate(due.date)} and nothing is booked`,
      );
      return true;
    });
    if (!claimed) continue;

    const sent = options.send ? await options.send(due) : false;
    if (sent) {
      reminded.push(due);
      continue;
    }
    // On the trail rather than only in the journal, because the office
    // reading this enquiry is the one who now has to chase it by hand.
    await db.transaction((tx) =>
      log(tx, { enquiryId: row.id }, "note", "That reminder did not leave: the email was not sent."),
    );
    unsent.push(due);
  }

  return { inWindow: true, checked: candidates.length, reminded, unsent };
}

/**
 * Closes the enquiries whose journey has been and gone.
 *
 * Nobody decided these; the date simply passed. Before this they sat in New
 * or Quoted indefinitely, so the office's own list of live work filled with
 * journeys that could no longer happen, and the conversion figure counted
 * every one of them.
 *
 * Safe to run again, and again, which an hourly timer needs it to be:
 *
 *  - An enquiry already `expired` is not a candidate, so a second sweep over
 *    the same rows finds nothing to do.
 *  - No enquiry is closed twice in its life. The `expired` line on the trail
 *    is the sweep's own record that it has been here, and a row carrying one
 *    is never a candidate again. That is what makes the office's Reopen
 *    button mean something: an enquiry somebody deliberately put back into
 *    Contacted is theirs from then on, and the sweep does not quietly close
 *    it again an hour later behind their back.
 *  - The update repeats the whole eligibility test in its own `where`, so a
 *    row the office moved to Won between the select and the write is left
 *    alone rather than overwritten.
 *  - The line is written only for a row the update actually changed —
 *    `returning` decides that, not the select — so even a race cannot leave
 *    a second one.
 *
 * The coarse filter is a query and the final judgement is `journeyHasPassed`
 * in JavaScript: the London day and the London clock are decided in one
 * place for the whole system, rather than depending on what timezone the
 * database happens to be configured with.
 *
 * `dryRun` reports what it would close and writes nothing. It takes the same
 * path to the same answer and stops short of the update, rather than being a
 * second implementation that could come to disagree with this one.
 */
export async function expireDueEnquiries(
  options: { now?: Date; dryRun?: boolean } = {},
): Promise<{ checked: number; expired: ExpiredEnquiry[] }> {
  const now = options.now ?? new Date();
  const today = londonToday(now);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${EXPIRY_LOCK})`);

    // Everything that could be due: open, not yet a booking, and dated
    // today or earlier. Today is included because a journey timed for this
    // morning has already gone by this afternoon.
    const candidates = await tx
      .select({
        id: schema.enquiry.id,
        reference: schema.enquiry.reference,
        journey: schema.enquiry.journey,
      })
      .from(schema.enquiry)
      .where(
        and(
          inArray(schema.enquiry.status, [...EXPIRABLE]),
          isNull(schema.enquiry.bookingId),
          sql`${schema.enquiry.journey} ->> 'date' <> ''`,
          sql`${schema.enquiry.journey} ->> 'date' <= ${today}`,
          // Never twice in one enquiry's life — see above.
          sql`not exists (
            select 1 from ${schema.activityEntry}
             where ${schema.activityEntry.enquiryId} = ${schema.enquiry.id}
               and ${schema.activityEntry.kind} = 'expired'
          )`,
        ),
      )
      .orderBy(asc(schema.enquiry.createdAt));

    const expired: ExpiredEnquiry[] = [];
    for (const row of candidates) {
      if (!journeyHasPassed(row.journey, now)) continue;

      const due = { id: row.id, reference: row.reference, date: row.journey.date, time: row.journey.time };
      if (options.dryRun) {
        expired.push(due);
        continue;
      }

      const [changed] = await tx
        .update(schema.enquiry)
        .set({ status: "expired", lostReason: null, updatedAt: new Date() })
        .where(
          and(
            eq(schema.enquiry.id, row.id),
            inArray(schema.enquiry.status, [...EXPIRABLE]),
            isNull(schema.enquiry.bookingId),
          ),
        )
        .returning({ reference: schema.enquiry.reference });
      if (!changed) continue;

      // Its own kind, worded so the office can tell at a glance that nobody
      // did this. "Status changed to Expired" would read like a decision.
      await log(
        tx,
        { enquiryId: row.id },
        "expired",
        `Expired — the journey was for ${formatDate(row.journey.date)} and no booking was made`,
      );
      expired.push({ ...due, reference: changed.reference });
    }

    return { checked: candidates.length, expired };
  });
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

/**
 * The next reference in a series, e.g. BKG-2101.
 *
 * Postgres hands these out, not us. Reading the highest reference and adding
 * one is a race against a UNIQUE column: two people sending the form in the
 * same second read the same maximum and the second insert is refused — a 500
 * for someone who did nothing wrong. A sequence gives each caller a number
 * nobody else will get, and neither transaction waits on the other.
 */
async function nextReference(tx: Tx, prefix: "ENQ" | "BKG") {
  const sequence = prefix === "BKG" ? "booking_reference_seq" : "enquiry_reference_seq";
  const result = await tx.execute<{ value: string }>(
    sql`select nextval(${sequence}::regclass)::text as value`,
  );
  return `${prefix}-${result.rows[0]!.value}`;
}

async function vehicleExists(tx: Tx, id: string) {
  const [row] = await tx
    .select({ id: schema.vehicle.id })
    .from(schema.vehicle)
    .where(eq(schema.vehicle.id, id))
    .limit(1);
  return row != null;
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
    const reference = await nextReference(tx, "BKG");
    // The car asked about may have left the fleet since the enquiry came in.
    const vehicleId =
      enquiry.journey.vehicleId && (await vehicleExists(tx, enquiry.journey.vehicleId))
        ? enquiry.journey.vehicleId
        : null;

    await tx.insert(schema.booking).values({
      id: bookingId,
      reference,
      customerId: enquiry.customerId,
      enquiryId: enquiry.id,
      service: enquiry.journey.service,
      vehicleId,
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

// -------------------------------------------------------- the public forms

/**
 * A returning customer, matched on their email address and then on their
 * telephone number.
 *
 * Both comparisons are written exactly as the functional indexes behind them
 * are — `lower(trim(email))` and the digits of the phone — because an index
 * is only used when the expression matches to the letter. This used to read
 * every customer into the API and compare in JavaScript, which worked while
 * there were forty of them.
 */
async function findCustomerId(tx: Tx, email: string, phone: string) {
  if (email) {
    const [match] = await tx
      .select({ id: schema.customer.id })
      .from(schema.customer)
      .where(sql`lower(trim(${schema.customer.email})) = ${email}`)
      .limit(1);
    if (match) return match.id;
  }
  if (phone) {
    const [match] = await tx
      .select({ id: schema.customer.id })
      .from(schema.customer)
      /**
       * The last ten digits — the national number itself. The same person
       * writes 07700 900123 on one form and +44 7700 900123 on the next, and
       * both end in 7700900123, which is the pair this matching exists to
       * see.
       *
       * It was nine, and nine was too few: +441123123123, 07123123123 and a
       * bare 123123123 all end in the same nine digits, so three unrelated
       * people matched one another and whoever was taking a booking watched
       * the name they had just typed turn into a stranger's.
       *
       * '\\D' and not '\D': the template literal is JavaScript first, and
       * Postgres has to receive the backslash for the class to mean anything.
       */
      .where(
        sql`right(regexp_replace(${schema.customer.phone}, '\\D', '', 'g'), 10) = ${phone.slice(-10)}`,
      )
      .limit(1);
    if (match) return match.id;
  }
  return null;
}

/**
 * The customer behind a public submission — matched if we have met them
 * before, created if not. A submission with neither an email address nor a
 * telephone number gets no customer record at all: there would be nothing to
 * match it to next time, and a wall of nameless duplicates helps nobody.
 */
/**
 * `always` is for a booking the office takes itself.
 *
 * A visitor who leaves neither an address nor a number gets no customer
 * record: there would be nothing to match them by next time, and a wall of
 * nameless duplicates helps nobody. But when the office writes a name down
 * off the telephone, that name is the whole of what it knows about the
 * person, and dropping it because no number was given loses the one thing it
 * was told — the booking would show no customer at all.
 */
async function customerFor(
  tx: Tx,
  input: { name: string; phone: string; email: string },
  { always = false } = {},
) {
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.replace(/\D/g, "");
  if (!email && !phone && !always) return null;

  const existing = await findCustomerId(tx, email, phone);
  if (existing) return existing;

  const id = newId("cus");
  await tx.insert(schema.customer).values({
    id,
    name: input.name,
    type: "private",
    company: "",
    phone: input.phone,
    email: input.email,
    notes: "",
  });
  return id;
}

/** How the activity trail says where an enquiry came in. */
const receivedFrom: Record<EnquirySource, string> = {
  website: "from the website",
  whatsapp: "on WhatsApp",
  phone: "by telephone",
  email: "by email",
  referral: "by referral",
};

/** "" means the browser sent no id; the column stays null so the unique index ignores it. */
const submissionIdOf = (input: { submissionId: string }) => input.submissionId.trim() || null;

/** Postgres refusing a duplicate key — here, a second attempt at one submission. */
function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error != null && (error as { code?: string }).code === "23505";
}

/**
 * Records an enquiry sent from the public website.
 *
 * Sending it twice records it once. A visitor who presses "Open WhatsApp
 * again", loses signal mid-send or double-taps the button sends the same
 * `submissionId` each time, and gets the same reference back rather than
 * leaving the office two identical enquiries to reconcile. The unique index
 * is what enforces it — the read below is only the quick way there, and the
 * duplicate-key catch is what covers two requests arriving at once.
 *
 * `source` is for the other public door. The WhatsApp assistant takes the
 * same enquiry a stranger could make on the form, and records it through
 * this function so the same rules, the same customer matching and the same
 * numbering apply; the only thing that differs is where the office is told
 * it came from. Left out, it is the website, as it always was.
 */
export async function createPublicEnquiry(
  input: PublicEnquiryInput,
  { source = "website" }: { source?: EnquirySource } = {},
): Promise<Enquiry> {
  const submissionId = submissionIdOf(input);

  const alreadyRecorded = async () => {
    if (!submissionId) return null;
    const [row] = await db
      .select({ id: schema.enquiry.id })
      .from(schema.enquiry)
      .where(eq(schema.enquiry.submissionId, submissionId))
      .limit(1);
    return row ? getEnquiry(row.id) : null;
  };

  // The same submission gets the same answer, whenever it arrives. A webhook
  // redelivered after the date has passed, or after the client narrowed where
  // we go, still names an enquiry that was taken, and is answered with it.
  const existing = await alreadyRecorded();
  if (existing) return existing;

  // Every caller here is a customer: the website's form, or the assistant
  // taking a journey down on WhatsApp. A journey we do not take is refused
  // before a reference is ever issued, so there is no record for the office
  // to find and no number to tell anybody.
  await assertJourneyIsOneWeTake(input);

  const id = newId("enq");
  try {
    await db.transaction(async (tx) => {
      const customerId = await customerFor(tx, input);
      // The id comes from the visitor's browser. One that names no car is
      // dropped rather than refused — the enquiry is worth more than the
      // field — and never reaches the booking it may later become.
      const vehicleId =
        input.vehicleId && (await vehicleExists(tx, input.vehicleId)) ? input.vehicleId : null;
      const reference = await nextReference(tx, "ENQ");

      await tx.insert(schema.enquiry).values({
        id,
        reference,
        submissionId,
        customerId,
        contact: { name: input.name, phone: input.phone, email: input.email },
        source,
        replyBy: input.replyBy,
        journey: {
          service: input.service,
          vehicleId,
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
      await log(tx, { enquiryId: id }, "created", `Enquiry ${reference} received ${receivedFrom[source]}`);
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const recorded = await alreadyRecorded();
    if (!recorded) throw error;
    return recorded;
  }

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

/**
 * The other jobs that car is already down for that day.
 *
 * Not an availability check, because this system has no idea how long a
 * journey takes: a booking carries a date and a time and nothing that says
 * when the car is free again. A Cullinan doing a wedding at eleven and an
 * airport run at eight in the evening is an ordinary day, so a clash here is
 * a thing to look at rather than a thing to refuse — the office knows which
 * of the two it is and the software does not.
 *
 * Cancelled bookings are left out; they are history, not a commitment.
 */
/**
 * A booking the office takes itself, with no enquiry behind it.
 *
 * The telephone rings and the journey is agreed in the same breath, so there
 * is nothing to convert — an enquiry would be a record of a question nobody
 * asked. What matters is that the customer is the same person the business
 * already knows: `customerFor` matches on the address or the number before it
 * creates anybody, so a regular who rings every month does not accumulate a
 * customer record per journey.
 *
 * Whether the car is already out that day is deliberately not checked here.
 * The office can see it on the screen before it saves, and only the office
 * knows whether two journeys in one day is a clash or a Tuesday.
 *
 * `request` is the one other way in: a customer on WhatsApp asking for a
 * booking. It is the same diary and the same customers, so it goes through
 * here rather than a copy of this — but it is a request, not a booking the
 * office agreed. So it is always pending whatever the input says, the trail
 * says it is not yet confirmed, and it is idempotent on the submission id
 * the way the website's enquiries are: a message delivered twice asks once.
 */
export async function createBooking(
  input: BookingInput,
  options: { request?: { channel: "whatsapp"; submissionId: string } } = {},
): Promise<Booking> {
  const request = options.request;
  const submissionId = request ? submissionIdOf(request) : null;

  const alreadyRecorded = async () => {
    if (!submissionId) return null;
    const [row] = await db
      .select({ id: schema.booking.id })
      .from(schema.booking)
      .where(eq(schema.booking.submissionId, submissionId))
      .limit(1);
    return row ? getBooking(row.id) : null;
  };

  const existing = await alreadyRecorded();
  if (existing) return existing;

  /**
   * The route parses the same rule before this is reached, but the rules of
   * the diary live here rather than at the edge — `createBookingFromEnquiry`
   * refuses a dateless booking too, and a booking with no day against it is
   * not a booking whichever door it came through.
   */
  if (!input.date) {
    assertValid({ date: "Choose the date of the journey." });
  }

  if (input.vehicleId && !(await vehicleExists(db as unknown as Tx, input.vehicleId))) {
    assertValid({ vehicleId: "That car is not in the fleet any more — choose another." });
  }

  const id = newId("bkg");
  // A customer cannot confirm their own booking, whatever the input claims.
  const status = request ? "pending" : input.status;

  try {
    await db.transaction(async (tx) => {
      const customerId = await customerFor(tx, input, { always: true });
      const reference = await nextReference(tx, "BKG");

      await tx.insert(schema.booking).values({
        id,
        reference,
        customerId,
        enquiryId: null,
        service: input.service,
        vehicleId: input.vehicleId,
        date: input.date,
        time: input.time,
        pickup: input.pickup,
        destination: input.dropoff,
        passengers: input.passengers,
        notes: input.notes,
        status,
        submissionId,
      });

      await log(
        tx,
        { bookingId: id },
        "created",
        request
          ? `Booking ${reference} requested on WhatsApp — not yet confirmed`
          : `Booking ${reference} taken by the office — ${labelFor(bookingStatuses, status)}`,
      );
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const recorded = await alreadyRecorded();
    if (!recorded) throw error;
    return recorded;
  }

  return getBooking(id);
}

/**
 * Who this booking would be attached to, asked before it is saved.
 *
 * Matching a caller to the customer the business already has is the right
 * thing to do — it is how a regular keeps one history instead of twelve — but
 * doing it silently is not. The name on the booking becomes the name already
 * on file, and somebody who has just typed a different one sees it replaced
 * without a word and reasonably concludes the screen is broken.
 *
 * So the screen asks first and says what it found, and the person taking the
 * booking decides whether it is the same person.
 */
export async function customerMatch(phone: string, email: string): Promise<Customer | null> {
  const normalisedEmail = email.trim().toLowerCase();
  const digits = phone.replace(/\D/g, "");
  if (!normalisedEmail && !digits) return null;

  const id = await findCustomerId(db as unknown as Tx, normalisedEmail, digits);
  if (!id) return null;

  const [row] = await db.select().from(schema.customer).where(eq(schema.customer.id, id)).limit(1);
  return row ? toCustomer(row) : null;
}

/**
 * Whether the number on a record is the number a WhatsApp message came from.
 *
 * What makes an enquiry or a booking someone's is the number written on it —
 * not the customer record it was filed under. Customers are matched by email
 * before telephone (`findCustomerId`), and nothing about a public form proves
 * an email address belongs to whoever typed it: someone could submit the form
 * with another person's email and their own number first, and every enquiry
 * that person made afterwards would be filed under a customer carrying the
 * stranger's number. So ownership is read from the record itself.
 *
 * And it is the whole number, in E.164, not its last ten digits. The office
 * writes UK numbers without the +44, which is why the stored one is read as
 * British when it has no country code; but ten digits are shared across
 * countries — +1 771 234 5678 and +44 7712 345678 both end in 7712345678 —
 * and the last ten digits once let one read the other's enquiry. A number
 * that cannot be read as a real one matches nothing.
 */
export function isSendersNumber(onFile: string | null | undefined, sender: string): boolean {
  // WhatsApp always delivers +44…; reading a bare number as British only
  // matters for the one on file, and changes nothing for one with its code.
  const from = tryNormalisePhone(sender, { defaultRegion: "GB" });
  const stored = onFile ? tryNormalisePhone(onFile, { defaultRegion: "GB" }) : null;
  return from !== null && stored === from;
}

/** The last ten digits of the enquiry's own number, as SQL — a coarse filter, finished by `isSendersNumber`. */
const enquiryPhoneTail = sql`right(regexp_replace(${schema.enquiry.contact} ->> 'phone', '\\D', '', 'g'), 10)`;

/**
 * An enquiry, but only for the person it belongs to.
 *
 * A customer on WhatsApp may ask how their enquiry is getting on, quoting its
 * reference. References are sequential, so anybody could guess the next one;
 * what makes it theirs is that the enquiry carries the number they are
 * writing from (`isSendersNumber`), so `07700 900321` typed on the website
 * answers to `+447700900321`. Somebody else's reference comes back exactly as
 * one that does not exist.
 */
export async function enquiryForPhone(reference: string, phone: string): Promise<Enquiry | null> {
  const wanted = reference.trim().toUpperCase();
  if (!wanted) return null;

  const [row] = await db
    .select({ id: schema.enquiry.id, contact: schema.enquiry.contact })
    .from(schema.enquiry)
    .where(eq(schema.enquiry.reference, wanted))
    .limit(1);
  return row && isSendersNumber(row.contact?.phone, phone) ? getEnquiry(row.id) : null;
}

/**
 * An enquiry a customer on WhatsApp is allowed to change.
 *
 * Stricter than `enquiryForPhone` on purpose, and deliberately not built on
 * it. Reading your own enquiry is fair wherever it came from; changing one
 * is not. An enquiry made on the website was taken by a person, may have
 * been quoted or discussed by telephone, and is the office's to amend, so
 * the source is part of the permission and not a detail the assistant is
 * asked to remember.
 *
 * A reference that exists but is not theirs, and one that does not exist at
 * all, both come back `null`. The caller cannot tell them apart, so nothing
 * can be learned by trying references in turn.
 */
export async function whatsappEnquiryForPhone(reference: string, phone: string): Promise<Enquiry | null> {
  const wanted = reference.trim().toUpperCase();
  if (!wanted) return null;

  const [row] = await db
    .select({ id: schema.enquiry.id, contact: schema.enquiry.contact })
    .from(schema.enquiry)
    .where(and(eq(schema.enquiry.reference, wanted), eq(schema.enquiry.source, "whatsapp")))
    .limit(1);
  return row && isSendersNumber(row.contact?.phone, phone) ? getEnquiry(row.id) : null;
}

/**
 * Every enquiry this number made, newest first: on WhatsApp, or on the
 * website with this number on the form.
 *
 * What makes "cancel the one for Saturday" answerable: the assistant can see
 * what the customer has, so it never has to ask them to find a reference,
 * and it can tell when a request matches more than one and has to ask which.
 * Reading is fair wherever an enquiry came from, exactly as
 * `enquiryForPhone` is; changing one still goes through
 * `whatsappEnquiryForPhone`.
 *
 * Closed ones are included and labelled rather than hidden, because "what
 * happened to my enquiry?" about a cancelled one deserves an answer.
 */
export async function enquiriesForPhone(phone: string, options: { source?: EnquirySource } = {}): Promise<Enquiry[]> {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return [];

  const tail = sql`${enquiryPhoneTail} = ${digits.slice(-10)}`;
  const rows = await db
    .select({ id: schema.enquiry.id, contact: schema.enquiry.contact })
    .from(schema.enquiry)
    .where(options.source ? and(eq(schema.enquiry.source, options.source), tail) : tail)
    .orderBy(desc(schema.enquiry.createdAt))
    .limit(60);

  const theirs = rows.filter((row) => isSendersNumber(row.contact?.phone, phone)).slice(0, 20);
  return Promise.all(theirs.map((row) => getEnquiry(row.id)));
}

/** Only the ones this number made on WhatsApp: the ones it may change from there. */
export const whatsappEnquiriesForPhone = (phone: string) => enquiriesForPhone(phone, { source: "whatsapp" });

/**
 * A booking, but only for the person it belongs to.
 *
 * The same rule as `enquiryForPhone`: the number that makes it theirs is the
 * one on the enquiry it was made from. A booking the office took itself, with
 * no enquiry behind it, has only its customer's number to go by.
 */
export async function bookingForPhone(reference: string, phone: string): Promise<Booking | null> {
  const wanted = reference.trim().toUpperCase();
  if (!wanted) return null;

  const [row] = await db
    .select({ id: schema.booking.id, contact: schema.enquiry.contact, customerPhone: schema.customer.phone })
    .from(schema.booking)
    .leftJoin(schema.enquiry, eq(schema.enquiry.id, schema.booking.enquiryId))
    .leftJoin(schema.customer, eq(schema.customer.id, schema.booking.customerId))
    .where(eq(schema.booking.reference, wanted))
    .limit(1);
  if (!row) return null;
  const onFile = row.contact ? row.contact.phone : row.customerPhone;
  return isSendersNumber(onFile, phone) ? getBooking(row.id) : null;
}

export async function clashesFor(
  vehicleId: string | null,
  date: string,
  exclude: string | null = null,
): Promise<Booking[]> {
  if (!vehicleId || !date) return [];

  const rows = await db
    .select()
    .from(schema.booking)
    .where(
      and(
        eq(schema.booking.vehicleId, vehicleId),
        eq(schema.booking.date, date),
        ne(schema.booking.status, "cancelled"),
        ...(exclude ? [ne(schema.booking.id, exclude)] : []),
      ),
    )
    .orderBy(asc(schema.booking.time));

  const activity = await bookingActivity(rows.map((row) => row.id));
  return rows.map((row) => toBooking(row, activity(row.id)));
}

export async function bookingClashes(id: string): Promise<Booking[]> {
  const [booking] = await db.select().from(schema.booking).where(eq(schema.booking.id, id)).limit(1);
  if (!booking) throw new CmsNotFoundError("This booking");
  return clashesFor(booking.vehicleId, booking.date, booking.id);
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
