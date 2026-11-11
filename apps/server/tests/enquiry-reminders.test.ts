/**
 * Writing to the customers whose journey is nearly here.
 *
 * This is the only thing in the system that writes to a customer without a
 * person deciding to, so the tests are about what it must never do: write
 * twice, write at four in the morning, write to somebody who has booked,
 * write about a journey that has already been and gone, or write to an
 * enquiry the office has finished with. Each one is checked against the real
 * tables, because that is where the eligibility predicate lives.
 *
 * Nothing here can send an email: `send` is passed in, and these tests pass
 * a recorder.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

// A type-only import: erased before it runs, so it cannot defeat the module
// mocking the harness does.
import type { DueReminder } from "../src/repositories/operations";
import { setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let operations: typeof import("../src/repositories/operations");

/** Mid-afternoon in London, in November, so London and UTC agree. */
const NOW = new Date("2026-11-08T14:00:00Z");
/** The small hours, when nobody may be written to. */
const NIGHT = new Date("2026-11-08T04:00:00Z");
/** Two days after NOW: the day a reminder is for. */
const SOON = "2026-11-10";

beforeAll(async () => {
  database = await startDatabase();
  operations = await import("../src/repositories/operations");
}, 60_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.reset();
}, 30_000);

/** A recorder in place of the mailer, which answers however a test needs. */
function recorder(outcome = true) {
  const sent: { reference: string; email: string; date: string; time: string; name: string }[] = [];
  return {
    sent,
    send: async (reminder: DueReminder) => {
      // The generated id is not what a reminder is judged on.
      const { reference, email, date, time, name } = reminder;
      sent.push({ reference, email, date, time, name });
      return outcome;
    },
  };
}

/**
 * An enquiry whose journey is on `date` at `time`.
 *
 * Made for a date well ahead — the server refuses anything else — and then
 * moved, the way the passing of time would leave it. `madeAt` is when the
 * customer wrote in: a week before NOW unless a test is about a new one.
 */
async function enquiryFor(
  date: string,
  time: string,
  over: { status?: string; bookingId?: string; email?: string; madeAt?: string } = {},
) {
  const made = await operations.createPublicEnquiry(
    {
      name: "Amelia Hughes",
      phone: "07700 900321",
      email: over.email ?? "amelia@example.test",
      replyBy: "email",
      service: "weddings",
      vehicleId: null,
      pickup: "Mayfair",
      dropoff: "Heathrow",
      date: "2027-06-19",
      time: "10:00",
      passengers: 3,
      luggage: "One case",
      flight: "",
      message: "",
      submissionId: "",
      website: "",
    } as Parameters<typeof operations.createPublicEnquiry>[0],
    { source: "website" },
  );

  await database.client.query(
    `update enquiry
        set journey = jsonb_set(jsonb_set(journey, '{date}', $1::jsonb), '{time}', $2::jsonb),
            status = coalesce($3, status),
            booking_id = coalesce($4, booking_id),
            created_at = $6::timestamptz
      where id = $5`,
    [
      JSON.stringify(date),
      JSON.stringify(time),
      over.status ?? null,
      over.bookingId ?? null,
      made.id,
      over.madeAt ?? "2026-11-01T10:00:00Z",
    ],
  );

  return made;
}

/** The trail, by kind, read straight from the table. */
async function trailOf(id: string, kind: string) {
  const rows = await database.client.query<{ text: string }>(
    `select text from activity_entry where enquiry_id = $1 and kind = $2 order by at`,
    [id, kind],
  );
  return rows.rows.map((row) => row.text);
}

describe("a journey that is nearly here", () => {
  test("the customer is written to, once, and the trail says so", async () => {
    const made = await enquiryFor(SOON, "09:00");
    const mail = recorder();

    const first = await operations.remindDueEnquiries({ now: NOW, send: mail.send });

    expect(first.inWindow).toBe(true);
    expect(first.reminded.map((one) => one.reference)).toEqual([made.reference]);
    expect(first.unsent).toEqual([]);
    expect(mail.sent).toEqual([
      { reference: made.reference, email: "amelia@example.test", date: SOON, time: "09:00", name: "Amelia Hughes" },
    ]);
    expect(await trailOf(made.id, "reminded")).toEqual([
      `Reminder emailed to amelia@example.test — the journey is on 10 Nov 2026 and nothing is booked`,
    ]);
  });

  test("running again writes to nobody and leaves one line", async () => {
    const made = await enquiryFor(SOON, "09:00");
    const mail = recorder();

    await operations.remindDueEnquiries({ now: NOW, send: mail.send });
    const again = await operations.remindDueEnquiries({ now: NOW, send: mail.send });
    const third = await operations.remindDueEnquiries({ now: new Date("2026-11-09T11:00:00Z"), send: mail.send });

    expect(again.reminded).toEqual([]);
    expect(third.reminded).toEqual([]);
    expect(mail.sent).toHaveLength(1);
    expect(await trailOf(made.id, "reminded")).toHaveLength(1);
  });

  test("a journey later today is still worth a reminder", async () => {
    await enquiryFor("2026-11-08", "18:00");
    const mail = recorder();

    const result = await operations.remindDueEnquiries({ now: NOW, send: mail.send });

    expect(result.reminded).toHaveLength(1);
  });

  test("a journey earlier today is not: it has been and gone", async () => {
    await enquiryFor("2026-11-08", "09:00");
    const mail = recorder();

    const result = await operations.remindDueEnquiries({ now: NOW, send: mail.send });

    expect(result.reminded).toEqual([]);
    expect(mail.sent).toEqual([]);
  });
});

describe("who is left alone", () => {
  test("a journey further off than the reminder window", async () => {
    await enquiryFor("2026-11-20", "09:00");
    const mail = recorder();
    expect((await operations.remindDueEnquiries({ now: NOW, send: mail.send })).reminded).toEqual([]);
  });

  test("a journey that has already passed", async () => {
    await enquiryFor("2026-11-06", "09:00");
    const mail = recorder();
    expect((await operations.remindDueEnquiries({ now: NOW, send: mail.send })).reminded).toEqual([]);
  });

  test("an enquiry with no email address, however close the journey", async () => {
    const made = await enquiryFor(SOON, "09:00", { email: "" });
    const mail = recorder();

    expect((await operations.remindDueEnquiries({ now: NOW, send: mail.send })).reminded).toEqual([]);
    expect(mail.sent).toEqual([]);
    expect(await trailOf(made.id, "reminded")).toEqual([]);
  });

  test("an enquiry made an hour ago, for tomorrow: the office has not had its day", async () => {
    const made = await enquiryFor("2026-11-09", "09:00", { madeAt: "2026-11-08T13:00:00Z" });
    const mail = recorder();

    expect((await operations.remindDueEnquiries({ now: NOW, send: mail.send })).reminded).toEqual([]);
    expect(mail.sent).toEqual([]);
    expect(await trailOf(made.id, "reminded")).toEqual([]);
  });

  test("the same enquiry a day later, still unanswered, is written to", async () => {
    const made = await enquiryFor("2026-11-10", "09:00", { madeAt: "2026-11-08T13:00:00Z" });
    const mail = recorder();

    const early = await operations.remindDueEnquiries({ now: new Date("2026-11-09T12:00:00Z"), send: mail.send });
    const later = await operations.remindDueEnquiries({ now: new Date("2026-11-09T13:00:00Z"), send: mail.send });

    expect(early.reminded).toEqual([]);
    expect(later.reminded.map((one) => one.reference)).toEqual([made.reference]);
  });

  test("an enquiry that already has a booking", async () => {
    await enquiryFor(SOON, "09:00", { bookingId: "bkg_whatever" });
    const mail = recorder();
    expect((await operations.remindDueEnquiries({ now: NOW, send: mail.send })).reminded).toEqual([]);
  });

  test("an enquiry the office has finished with", async () => {
    for (const status of ["won", "lost", "cancelled", "expired"]) {
      await database.reset();
      await enquiryFor(SOON, "09:00", { status });
      const mail = recorder();
      const result = await operations.remindDueEnquiries({ now: NOW, send: mail.send });
      expect(result.reminded, `status ${status}`).toEqual([]);
    }
  });
});

describe("the hours a company writes to people", () => {
  test("at four in the morning nothing is sent and nothing is written", async () => {
    const made = await enquiryFor(SOON, "09:00");
    const mail = recorder();

    const result = await operations.remindDueEnquiries({ now: NIGHT, send: mail.send });

    expect(result.inWindow).toBe(false);
    expect(result.checked).toBe(0);
    expect(mail.sent).toEqual([]);
    expect(await trailOf(made.id, "reminded")).toEqual([]);
  });

  test("the same enquiry is written to on the next run inside the hours", async () => {
    const made = await enquiryFor(SOON, "09:00");
    const mail = recorder();

    await operations.remindDueEnquiries({ now: NIGHT, send: mail.send });
    const morning = await operations.remindDueEnquiries({ now: new Date("2026-11-08T08:00:00Z"), send: mail.send });

    expect(morning.reminded.map((one) => one.reference)).toEqual([made.reference]);
  });

  test("eight in the evening is already too late", async () => {
    await enquiryFor(SOON, "09:00");
    const mail = recorder();
    const result = await operations.remindDueEnquiries({ now: new Date("2026-11-08T20:00:00Z"), send: mail.send });
    expect(result.inWindow).toBe(false);
  });
});

describe("when the email does not leave", () => {
  test("the trail says so, and it is not tried again", async () => {
    const made = await enquiryFor(SOON, "09:00");
    const failing = recorder(false);

    const result = await operations.remindDueEnquiries({ now: NOW, send: failing.send });

    expect(result.reminded).toEqual([]);
    expect(result.unsent.map((one) => one.reference)).toEqual([made.reference]);
    expect(await trailOf(made.id, "note")).toEqual(["That reminder did not leave: the email was not sent."]);
    // Claimed before sending, so a failure is not retried: a second reminder
    // is worse than none, and the note above is what the office acts on.
    const working = recorder();
    expect((await operations.remindDueEnquiries({ now: NOW, send: working.send })).reminded).toEqual([]);
    expect(working.sent).toEqual([]);
  });

  test("with no mailer at all, nothing is claimed as sent", async () => {
    const made = await enquiryFor(SOON, "09:00");
    const result = await operations.remindDueEnquiries({ now: NOW });
    expect(result.reminded).toEqual([]);
    expect(result.unsent).toHaveLength(1);
    expect(await trailOf(made.id, "note")).toHaveLength(1);
  });
});

describe("a dry run", () => {
  test("reports what it would do and writes and sends nothing", async () => {
    const made = await enquiryFor(SOON, "09:00");
    const mail = recorder();

    const result = await operations.remindDueEnquiries({ now: NOW, dryRun: true, send: mail.send });

    expect(result.reminded.map((one) => one.reference)).toEqual([made.reference]);
    expect(mail.sent).toEqual([]);
    expect(await trailOf(made.id, "reminded")).toEqual([]);
  });
});

describe("the two sweeps together", () => {
  test("nobody is reminded and closed in the same round", async () => {
    const soon = await enquiryFor(SOON, "09:00");
    const gone = await enquiryFor("2026-11-06", "09:00");
    const mail = recorder();

    const reminders = await operations.remindDueEnquiries({ now: NOW, send: mail.send });
    const closed = await operations.expireDueEnquiries({ now: NOW });

    expect(reminders.reminded.map((one) => one.reference)).toEqual([soon.reference]);
    expect(closed.expired.map((one) => one.reference)).toEqual([gone.reference]);
    expect(await trailOf(soon.id, "expired")).toEqual([]);
    expect(await trailOf(gone.id, "reminded")).toEqual([]);
  });
});
