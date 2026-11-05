/**
 * Closing the enquiries whose journey has been and gone.
 *
 * Nobody decides these, so the risks are not the usual ones. The sweep runs
 * hourly and unattended: it must do nothing the second time, it must not
 * touch an enquiry somebody is still working, and it must judge the day and
 * the clock in London rather than wherever the database thinks it is. All
 * three are tested against the real tables, because that is where the
 * eligibility predicate actually lives.
 *
 * Every journey here is created with a date in the future and then
 * back-dated in place, which is what really happens: the enquiry was made
 * in good time and then the day went by.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let operations: typeof import("../src/repositories/operations");

/** Mid-afternoon in London, in November, so London and UTC agree. */
const NOW = new Date("2026-11-05T14:00:00Z");

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

/**
 * An enquiry whose journey is on `date` at `time`.
 *
 * Made for a date well ahead — the server refuses anything else — and then
 * moved, by writing the journey the way the passing of time would leave it.
 */
async function enquiryFor(date: string, time: string, over: { status?: string; bookingId?: string } = {}) {
  const made = await operations.createPublicEnquiry(
    {
      name: "Amelia Hughes",
      phone: "07700 900321",
      email: "",
      replyBy: "whatsapp",
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
    { source: "whatsapp" },
  );

  await database.client.query(
    `update enquiry
        set journey = jsonb_set(jsonb_set(journey, '{date}', $1::jsonb), '{time}', $2::jsonb),
            status = coalesce($3, status),
            booking_id = coalesce($4, booking_id)
      where id = $5`,
    [JSON.stringify(date), JSON.stringify(time), over.status ?? null, over.bookingId ?? null, made.id],
  );

  return made;
}

/** The status and the expiry lines on the trail, read straight from the tables. */
async function recordOf(id: string) {
  const status = await database.client.query<{ status: string }>(`select status from enquiry where id = $1`, [id]);
  const trail = await database.client.query<{ text: string }>(
    `select text from activity_entry where enquiry_id = $1 and kind = 'expired' order by at`,
    [id],
  );
  return { status: status.rows[0]?.status, expiredLines: trail.rows.map((row) => row.text) };
}

describe("a journey that has been and gone", () => {
  test("yesterday's enquiry is closed, and the trail says nobody decided it", async () => {
    const made = await enquiryFor("2026-11-04", "10:00");

    const swept = await operations.expireDueEnquiries({ now: NOW });

    expect(swept.expired.map((item) => item.reference)).toEqual([made.reference]);
    const after = await recordOf(made.id);
    expect(after.status).toBe("expired");
    expect(after.expiredLines).toEqual(["Expired — the journey was for 4 Nov 2026 and no booking was made"]);
  });

  test("this morning's enquiry is closed this afternoon", async () => {
    const made = await enquiryFor("2026-11-05", "09:30");

    await operations.expireDueEnquiries({ now: NOW });

    expect((await recordOf(made.id)).status).toBe("expired");
  });

  test("this evening's enquiry is left alone", async () => {
    const made = await enquiryFor("2026-11-05", "18:00");

    const swept = await operations.expireDueEnquiries({ now: NOW });

    // It was looked at — today is in the query — and then left.
    expect(swept.checked).toBe(1);
    expect(swept.expired).toEqual([]);
    expect((await recordOf(made.id)).status).toBe("new");
  });

  test("a pick-up time nobody can read gets the whole day", async () => {
    // What the assistant records when the customer says it that way. The
    // journey could still be this evening, so the enquiry is not closed
    // until the date itself goes by.
    const vague = await enquiryFor("2026-11-05", "around 7");
    const none = await enquiryFor("2026-11-05", "");

    await operations.expireDueEnquiries({ now: NOW });

    expect((await recordOf(vague.id)).status).toBe("new");
    expect((await recordOf(none.id)).status).toBe("new");

    // And at midnight, both of them.
    await operations.expireDueEnquiries({ now: new Date("2026-11-06T09:00:00Z") });
    expect((await recordOf(vague.id)).status).toBe("expired");
    expect((await recordOf(none.id)).status).toBe("expired");
  });

  test("tomorrow's enquiry is not even a candidate", async () => {
    const made = await enquiryFor("2026-11-06", "09:00");

    const swept = await operations.expireDueEnquiries({ now: NOW });

    expect(swept.checked).toBe(0);
    expect((await recordOf(made.id)).status).toBe("new");
  });

  test("judges the day in London, not in UTC", async () => {
    // 23:30 UTC in June is half past midnight here, so a journey timed for
    // eleven on the 15th has gone even though UTC still reads the 15th.
    const made = await enquiryFor("2026-06-15", "23:00");

    await operations.expireDueEnquiries({ now: new Date("2026-06-15T23:30:00Z") });

    expect((await recordOf(made.id)).status).toBe("expired");
  });

  test("a date nobody can read is for a person, not for the sweep", async () => {
    const empty = await enquiryFor("", "09:00");
    const words = await enquiryFor("whenever suits", "09:00");

    const swept = await operations.expireDueEnquiries({ now: NOW });

    // The empty one is excluded by the query; the unreadable one survives
    // the final judgement in JavaScript.
    expect(swept.expired).toEqual([]);
    expect((await recordOf(empty.id)).status).toBe("new");
    expect((await recordOf(words.id)).status).toBe("new");
  });
});

describe("running it again, and again", () => {
  test("the second sweep finds nothing and writes nothing", async () => {
    const made = await enquiryFor("2026-11-04", "10:00");

    const first = await operations.expireDueEnquiries({ now: NOW });
    const second = await operations.expireDueEnquiries({ now: NOW });
    const third = await operations.expireDueEnquiries({ now: new Date("2026-11-09T14:00:00Z") });

    expect(first.expired).toHaveLength(1);
    expect(second).toEqual({ checked: 0, expired: [] });
    expect(third).toEqual({ checked: 0, expired: [] });

    // The one thing an hourly timer must never do: a second line every hour.
    expect((await recordOf(made.id)).expiredLines).toHaveLength(1);
  });

  test("an hour's worth of enquiries are closed in one pass, each with its own line", async () => {
    const one = await enquiryFor("2026-11-01", "10:00");
    const two = await enquiryFor("2026-11-02", "10:00");
    const three = await enquiryFor("2026-11-03", "");

    const swept = await operations.expireDueEnquiries({ now: NOW });

    expect(swept.checked).toBe(3);
    expect(swept.expired.map((item) => item.reference).sort()).toEqual(
      [one.reference, two.reference, three.reference].sort(),
    );
    for (const made of [one, two, three]) {
      expect((await recordOf(made.id)).expiredLines).toHaveLength(1);
    }
  });
});

describe("a dry run", () => {
  test("reports exactly what the real sweep then does, and writes nothing", async () => {
    const due = await enquiryFor("2026-11-04", "10:00");
    await enquiryFor("2026-11-05", "18:00");

    const rehearsal = await operations.expireDueEnquiries({ now: NOW, dryRun: true });

    expect(rehearsal.checked).toBe(2);
    expect(rehearsal.expired.map((item) => item.reference)).toEqual([due.reference]);
    // Nothing moved and nothing was written, so the enquiry is still a
    // candidate — which is the only way the two can be compared at all.
    const untouched = await recordOf(due.id);
    expect(untouched.status).toBe("new");
    expect(untouched.expiredLines).toHaveLength(0);

    const real = await operations.expireDueEnquiries({ now: NOW });
    expect(real.expired.map((item) => item.reference)).toEqual(rehearsal.expired.map((item) => item.reference));
    expect((await recordOf(due.id)).status).toBe("expired");
  });
});

describe("enquiries the sweep leaves alone", () => {
  test("one that became a booking, however old the journey", async () => {
    const made = await enquiryFor("2026-11-04", "10:00", { bookingId: "bkg-already" });

    const swept = await operations.expireDueEnquiries({ now: NOW });

    expect(swept.checked).toBe(0);
    expect((await recordOf(made.id)).status).toBe("new");
  });

  test("one the office has already settled", async () => {
    for (const settled of ["won", "lost", "cancelled", "expired"] as const) {
      await database.reset();
      const made = await enquiryFor("2026-11-04", "10:00", { status: settled });

      const swept = await operations.expireDueEnquiries({ now: NOW });

      expect(swept.checked).toBe(0);
      const after = await recordOf(made.id);
      expect(after.status).toBe(settled);
      expect(after.expiredLines).toHaveLength(0);
    }
  });

  test("a won enquiry with no booking stays won, where somebody will see it", async () => {
    // Deliberate. Won and past with nothing booked is a real problem, and
    // tidying it into Expired would hide the one record worth looking at.
    const made = await enquiryFor("2026-10-01", "10:00", { status: "won" });

    await operations.expireDueEnquiries({ now: NOW });

    expect((await recordOf(made.id)).status).toBe("won");
  });
});

describe("what an expired enquiry can still do", () => {
  test("nobody can set the status by hand", async () => {
    const made = await enquiryFor("2026-11-04", "10:00");

    const refused = await operations.updateEnquiryStatus(made.id, "expired").catch((error: unknown) => error);

    expect(refused).toBeInstanceOf(Error);
    expect((await recordOf(made.id)).status).toBe("new");
  });

  test("the customer is told the team has to reopen it", async () => {
    const made = await enquiryFor("2026-11-04", "10:00");
    await operations.expireDueEnquiries({ now: NOW });

    expect(operations.settledReason({ status: "expired", bookingId: null })).toBe(
      "The date on this enquiry has passed, so the team has to reopen it.",
    );

    // So neither door a customer has lets them move it.
    const amended = await operations
      .updateEnquiryJourney(made.id, { date: "2027-03-01" }, { by: "customer" })
      .catch((error: unknown) => error);
    const cancelled = await operations.cancelEnquiry(made.id, "whatsapp").catch((error: unknown) => error);

    expect(amended).toBeInstanceOf(Error);
    expect(cancelled).toBeInstanceOf(Error);
    expect((await recordOf(made.id)).status).toBe("expired");
  });

  test("the office reopens it, and the sweep does not take it back", async () => {
    const made = await enquiryFor("2026-11-04", "10:00");
    await operations.expireDueEnquiries({ now: NOW });

    const reopened = await operations.updateEnquiryStatus(made.id, "contacted");
    expect(reopened.status).toBe("contacted");

    // The date is still in the past, so every rule but one would close it
    // again within the hour. Somebody put it back deliberately; it is theirs.
    const swept = await operations.expireDueEnquiries({ now: new Date("2026-11-09T14:00:00Z") });

    expect(swept.checked).toBe(0);
    const after = await recordOf(made.id);
    expect(after.status).toBe("contacted");
    expect(after.expiredLines).toHaveLength(1);
  });

  test("and then they can amend it, which is how a customer who came back late is picked up", async () => {
    const made = await enquiryFor("2026-11-04", "10:00");
    await operations.expireDueEnquiries({ now: NOW });
    await operations.updateEnquiryStatus(made.id, "contacted");

    const amended = await operations.updateEnquiryJourney(made.id, { date: "2027-03-01", time: "11:00" });

    expect(amended.journey.date).toBe("2027-03-01");
    expect(amended.status).toBe("contacted");
  });
});
