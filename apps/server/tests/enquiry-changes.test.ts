/**
 * Amending and cancelling an enquiry.
 *
 * One capability behind two doors: the office amending an enquiry in the
 * admin, and a customer rescheduling their own on WhatsApp. The rules that
 * matter are the ones a customer could otherwise walk through — only your
 * own enquiries, only the ones that came from WhatsApp, and never one the
 * office has already acted on.
 *
 * Nothing here goes near a real database: PGlite runs the real migrations in
 * process.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { only, setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let operations: typeof import("../src/repositories/operations");

const AMELIA = "07700 900321";
const SOMEBODY_ELSE = "07700 900999";

beforeAll(async () => {
  database = await startDatabase();
  operations = await import("../src/repositories/operations");

  await database.client.exec(`
    insert into vehicle (id, slug, name, make, model, status, specs, pricing, images, seo, suited_tags, availability, ownership)
    values ('veh-ghost', 'ghost', 'Rolls-Royce Ghost', 'Rolls-Royce', 'Ghost', 'published',
            '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, 'chauffeur', 'owned'),
           ('veh-urus', 'urus', 'Lamborghini Urus', 'Lamborghini', 'Urus', 'published',
            '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, 'chauffeur', 'owned');
  `);
}, 60_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.reset();
}, 30_000);

/** An enquiry as the assistant records one. */
function enquiry(source: "whatsapp" | "website", over: Record<string, unknown> = {}) {
  return operations.createPublicEnquiry(
    {
      name: "Amelia Hughes",
      phone: AMELIA,
      email: "",
      replyBy: "whatsapp",
      service: "weddings",
      vehicleId: "veh-ghost",
      pickup: "Claridge's",
      dropoff: "Kew Gardens",
      date: "2027-06-19",
      time: "10:00",
      passengers: 3,
      luggage: "One case",
      flight: "",
      message: "Ribbons, please.",
      submissionId: "",
      website: "",
      ...over,
    } as Parameters<typeof operations.createPublicEnquiry>[0],
    { source },
  );
}

describe("amending the journey", () => {
  test("moves only what was asked for", async () => {
    const before = await enquiry("whatsapp");
    const after = await operations.updateEnquiryJourney(before.id, { date: "2027-06-25", time: "16:00" });

    expect(after.journey.date).toBe("2027-06-25");
    expect(after.journey.time).toBe("16:00");
    // Everything nobody mentioned is exactly as it was.
    expect(after.journey.pickup).toBe("Claridge's");
    expect(after.journey.dropoff).toBe("Kew Gardens");
    expect(after.journey.passengers).toBe(3);
    expect(after.journey.luggage).toBe("One case");
    expect(after.journey.vehicleId).toBe("veh-ghost");
    expect(after.message).toBe("Ribbons, please.");
  });

  test("leaves a trail saying what changed", async () => {
    const before = await enquiry("whatsapp");
    await operations.updateEnquiryJourney(before.id, { date: "2027-06-25", vehicleId: "veh-urus" });

    const trail = await database.client.query(
      `select kind, text from activity_entry where enquiry_id = '${before.id}' and kind = 'edit'`,
    );
    expect(trail.rows).toHaveLength(1);
    expect(String((trail.rows[0] as { text: string }).text)).toBe("Journey amended: vehicle and date");
  });

  test("a change to nothing writes nothing", async () => {
    const before = await enquiry("whatsapp");
    const after = await operations.updateEnquiryJourney(before.id, { time: "10:00" });

    expect(after.journey.time).toBe("10:00");
    expect(
      (await database.client.query(`select id from activity_entry where enquiry_id = '${before.id}' and kind = 'edit'`)).rows,
    ).toHaveLength(0);
  });

  test("the customer's own note can be changed too", async () => {
    const before = await enquiry("whatsapp");
    const after = await operations.updateEnquiryJourney(before.id, { message: "No ribbons after all." });

    expect(after.message).toBe("No ribbons after all.");
  });

  test("a date that has passed is refused, and nothing moves", async () => {
    const before = await enquiry("whatsapp");
    const failed = await operations.updateEnquiryJourney(before.id, { date: "2020-01-01" }).catch((error: unknown) => error);

    expect(failed).toBeInstanceOf(Error);
    expect((await operations.getEnquiry(before.id)).journey.date).toBe("2027-06-19");
  });

  test("a car that is not in the fleet is refused rather than ignored", async () => {
    const before = await enquiry("whatsapp");
    const failed = await operations.updateEnquiryJourney(before.id, { vehicleId: "veh-imaginary" }).catch((error: unknown) => error);

    expect(failed).toBeInstanceOf(Error);
    expect((await operations.getEnquiry(before.id)).journey.vehicleId).toBe("veh-ghost");
  });
});

describe("an enquiry the office has already acted on", () => {
  for (const settled of ["won", "lost", "cancelled"] as const) {
    test(`cannot be amended once it is ${settled}`, async () => {
      const before = await enquiry("whatsapp");
      if (settled === "cancelled") await operations.cancelEnquiry(before.id);
      else await operations.updateEnquiryStatus(before.id, settled, { lostReason: "other" });

      const failed = await operations.updateEnquiryJourney(before.id, { date: "2027-07-01" }).catch((error: unknown) => error);

      expect(failed).toBeInstanceOf(Error);
      expect((await operations.getEnquiry(before.id)).journey.date).toBe("2027-06-19");
    });
  }

  test("cannot be cancelled twice", async () => {
    const before = await enquiry("whatsapp");
    await operations.cancelEnquiry(before.id, "customer");
    const failed = await operations.cancelEnquiry(before.id, "customer").catch((error: unknown) => error);

    expect(failed).toBeInstanceOf(Error);
  });

  test("cannot be amended once it is a booking", async () => {
    const before = await enquiry("whatsapp");
    await operations.updateEnquiryStatus(before.id, "won");
    await operations.createBookingFromEnquiry(before.id);

    const failed = await operations.updateEnquiryJourney(before.id, { date: "2027-07-01" }).catch((error: unknown) => error);
    expect(failed).toBeInstanceOf(Error);
  });
});

describe("cancelling", () => {
  test("is its own status, with its own trail, and is not lost", async () => {
    const before = await enquiry("whatsapp");
    const after = await operations.cancelEnquiry(before.id, "customer");

    expect(after.status).toBe("cancelled");
    expect(after.lostReason).toBeNull();

    const trail = only(
      (await database.client.query(`select text from activity_entry where enquiry_id = '${before.id}' and kind = 'status'`)).rows,
    ) as { text: string };
    expect(trail.text).toBe("Cancelled by the customer on WhatsApp");
  });

  test("by the office says so instead", async () => {
    const before = await enquiry("whatsapp");
    await operations.cancelEnquiry(before.id, "office");

    const trail = only(
      (await database.client.query(`select text from activity_entry where enquiry_id = '${before.id}' and kind = 'status'`)).rows,
    ) as { text: string };
    expect(trail.text).toBe("Cancelled by the office");
  });

  test("through the status route lands in the same place", async () => {
    const before = await enquiry("whatsapp");
    const after = await operations.updateEnquiryStatus(before.id, "cancelled");

    expect(after.status).toBe("cancelled");
    expect(after.lostReason).toBeNull();
  });
});

describe("who may change what", () => {
  test("a WhatsApp enquiry is found by the number that made it", async () => {
    const made = await enquiry("whatsapp");
    const found = await operations.whatsappEnquiryForPhone(made.reference, "+447700900321");

    expect(found?.id).toBe(made.id);
  });

  test("a website enquiry is not, even from the same number", async () => {
    const made = await enquiry("website");

    expect(await operations.whatsappEnquiryForPhone(made.reference, AMELIA)).toBeNull();
    // Readable, though: asking after your own enquiry is fair wherever it came from.
    expect((await operations.enquiryForPhone(made.reference, AMELIA))?.id).toBe(made.id);
  });

  test("somebody else's reference is indistinguishable from one that does not exist", async () => {
    const made = await enquiry("whatsapp");

    expect(await operations.whatsappEnquiryForPhone(made.reference, SOMEBODY_ELSE)).toBeNull();
    expect(await operations.whatsappEnquiryForPhone("ENQ-9999", AMELIA)).toBeNull();
  });

  test("the list is this number's WhatsApp enquiries, newest first", async () => {
    const first = await enquiry("whatsapp", { date: "2027-06-19" });
    const second = await enquiry("whatsapp", { date: "2027-07-02", pickup: "The Savoy" });
    await enquiry("website", { date: "2027-08-01" });
    await operations.createPublicEnquiry(
      {
        name: "Someone Else",
        phone: SOMEBODY_ELSE,
        email: "",
        replyBy: "whatsapp",
        service: "weddings",
        vehicleId: null,
        pickup: "Soho",
        dropoff: "",
        date: "2027-09-09",
        time: "",
        passengers: null,
        luggage: "",
        flight: "",
        message: "",
        submissionId: "",
        website: "",
      } as Parameters<typeof operations.createPublicEnquiry>[0],
      { source: "whatsapp" },
    );

    const mine = await operations.whatsappEnquiriesForPhone(AMELIA);

    expect(mine.map((item) => item.reference)).toEqual([second.reference, first.reference]);
  });

  test("a number with no enquiries gets an empty list, not an error", async () => {
    expect(await operations.whatsappEnquiriesForPhone(SOMEBODY_ELSE)).toEqual([]);
  });
});
