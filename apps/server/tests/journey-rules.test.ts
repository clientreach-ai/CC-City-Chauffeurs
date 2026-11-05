/**
 * What the server will and will not record a journey for.
 *
 * The assistant used to hold these rules alone, which meant they held only
 * as well as a model follows an instruction: a journey from Essex to El
 * Salvador in 2089 was recorded, given a reference and sent to the office.
 * Now the refusal is the server's, so it applies to the website's form and
 * to WhatsApp alike, and no prompt can talk its way past it.
 *
 * The office is deliberately not held to it. A booking the office records,
 * and an amendment the office makes, describe work the business has actually
 * agreed; software telling the office it may not drive somewhere would be
 * wrong about who decides.
 *
 * Nothing here goes near a real database: PGlite runs the real migrations in
 * process.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { CmsValidationError } from "@CC-City-Chauffeurs/core";
import { publicEnquirySchema } from "@CC-City-Chauffeurs/core/schemas";

import { setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let operations: typeof import("../src/repositories/operations");

/** Far enough off to be inside any sane horizon, worked out rather than written. */
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const visitor = {
  name: "Amelia Hughes",
  phone: "07700 900321",
  email: "amelia@example.com",
  service: "private-chauffeur",
  replyBy: "whatsapp" as const,
};

/**
 * An enquiry as the assistant hands one over.
 *
 * Not parsed by the public schema, because the WhatsApp path does not parse:
 * `whatsapp-backend` builds the input from the validated journey draft and
 * calls the repository directly. Testing the repository the way WhatsApp
 * reaches it is the point — the website's own schema is checked separately
 * below.
 */
const enquiry = (journey: Record<string, unknown>) =>
  ({
    ...visitor,
    pickup: "Mayfair",
    dropoff: "",
    date: inDays(30),
    time: "",
    passengers: null,
    luggage: "",
    flight: "",
    message: "",
    vehicleId: null,
    submissionId: "",
    ...journey,
  }) as unknown as Parameters<typeof operations.createPublicEnquiry>[0];

/** The fields a refusal came back about. */
async function refusedFields(input: ReturnType<typeof enquiry>): Promise<string[]> {
  try {
    await operations.createPublicEnquiry(input);
    return [];
  } catch (error) {
    if (!(error instanceof CmsValidationError)) throw error;
    return Object.keys(error.fields);
  }
}

beforeAll(async () => {
  database = await startDatabase();
  operations = await import("../src/repositories/operations");
}, 60_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.reset();
});

describe("a journey we take", () => {
  test("is recorded, and gets a reference", async () => {
    const recorded = await operations.createPublicEnquiry(
      enquiry({ pickup: "Heathrow", dropoff: "Mayfair" }),
    );
    expect(recorded.reference).toMatch(/^ENQ-\d+$/);
    expect(recorded.status).toBe("new");
  });

  test("across the UK, not only the districts the footer lists", async () => {
    for (const dropoff of ["Manchester", "Birmingham", "Oxford", "Essex"]) {
      expect(await refusedFields(enquiry({ dropoff }))).toEqual([]);
    }
  });

  test("into Europe, which the client's own coverage sentence includes", async () => {
    for (const dropoff of ["Paris, France", "Monaco", "Geneva, Switzerland"]) {
      expect(await refusedFields(enquiry({ dropoff }))).toEqual([]);
    }
  });

  test("to a village nobody has listed, because unrecognised is not refused", async () => {
    expect(await refusedFields(enquiry({ dropoff: "Saffron Walden" }))).toEqual([]);
    expect(await refusedFields(enquiry({ dropoff: "the airport" }))).toEqual([]);
  });
});

describe("a journey we do not take", () => {
  test("is refused on the destination, and nothing is recorded", async () => {
    expect(await refusedFields(enquiry({ dropoff: "El Salvador" }))).toEqual(["dropoff"]);
    expect(await operations.getEnquiries()).toHaveLength(0);
  });

  test("is refused on the pick-up too", async () => {
    expect(await refusedFields(enquiry({ pickup: "Addis Ababa, Ethiopia" }))).toEqual(["pickup"]);
  });

  test("names the country in the message the customer sees", async () => {
    try {
      await operations.createPublicEnquiry(enquiry({ dropoff: "El Salvador" }));
      throw new Error("should have been refused");
    } catch (error) {
      expect(error).toBeInstanceOf(CmsValidationError);
      expect((error as CmsValidationError).fields.dropoff).toContain("El Salvador");
    }
  });

  test("the 2089 case: refused on the date, with no reference issued", async () => {
    expect(await refusedFields(enquiry({ date: "2089-01-08" }))).toEqual(["date"]);
    expect(await operations.getEnquiries()).toHaveLength(0);
  });

  test("a date that has gone is refused as well", async () => {
    expect(await refusedFields(enquiry({ date: inDays(-7) }))).toEqual(["date"]);
  });

  test("yesterday is allowed, the same one day the website's form allows", async () => {
    // "Today" for a customer messaging from abroad can be yesterday here,
    // and the two layers must not refuse different dates.
    expect(await refusedFields(enquiry({ date: inDays(-1) }))).toEqual([]);
  });

  test("the website's own form refuses a past date before the repository sees it", () => {
    const parsed = publicEnquirySchema.safeParse({ ...visitor, pickup: "Mayfair", date: inDays(-7) });
    expect(parsed.success).toBe(false);
  });

  test("every problem comes back at once, so the customer is asked once", async () => {
    const fields = await refusedFields(enquiry({ pickup: "Mars", dropoff: "El Salvador", date: "2089-01-08" }));
    expect(fields.sort()).toEqual(["date", "dropoff", "pickup"]);
  });
});

describe("the office is not held to it", () => {
  test("an amendment the office makes is not judged against coverage", async () => {
    const recorded = await operations.createPublicEnquiry(enquiry({ dropoff: "Mayfair" }));
    const amended = await operations.updateEnquiryJourney(recorded.id, { dropoff: "El Salvador" });
    expect(amended.journey.dropoff).toBe("El Salvador");
  });

  test("the same amendment from the customer is refused", async () => {
    const recorded = await operations.createPublicEnquiry(enquiry({ dropoff: "Mayfair" }));
    await expect(
      operations.updateEnquiryJourney(recorded.id, { dropoff: "El Salvador" }, { by: "customer" }),
    ).rejects.toBeInstanceOf(CmsValidationError);

    const unchanged = await operations.getEnquiry(recorded.id);
    expect(unchanged.journey.dropoff).toBe("Mayfair");
  });

  test("a customer may still amend to somewhere we do go", async () => {
    const recorded = await operations.createPublicEnquiry(enquiry({ dropoff: "Mayfair" }));
    const amended = await operations.updateEnquiryJourney(
      recorded.id,
      { dropoff: "Manchester", date: inDays(60) },
      { by: "customer" },
    );
    expect(amended.journey.dropoff).toBe("Manchester");
  });
});

describe("when the settings are missing entirely", () => {
  test("the rule still applies, from the defaults the seed would have written", async () => {
    // These tests run with no settings row at all, which is the case here:
    // a configuration fault must not lose a customer's enquiry, and must
    // not quietly switch the rule off either.
    expect(await refusedFields(enquiry({ dropoff: "El Salvador" }))).toEqual(["dropoff"]);
    expect(await refusedFields(enquiry({ dropoff: "Manchester" }))).toEqual([]);
  });

  test("reading the rules answers rather than throwing", async () => {
    // The assistant asks for these through the backend before it answers
    // anything at all, and a throw here took the whole tool catalogue down
    // with it — no fleet, no services, no company details, because the
    // settings row had not been written yet.
    const rules = await operations.journeyRules();

    expect(rules.maxMonthsAhead).toBeGreaterThan(0);
    expect(rules.coverage.servedCountries.length).toBeGreaterThan(0);
    expect(rules.coverage.servedPlaces.length).toBeGreaterThan(0);
  });

  test("the assistant and the server read the same rules, from one function", async () => {
    // Not "the same values" — the same call. Two readers of the settings is
    // two places for the conversation and the record to disagree about
    // where we drive.
    const { createWhatsAppBackend } = await import("../src/lib/whatsapp-backend");
    const backend = createWhatsAppBackend();

    expect(await backend.journeyRules()).toEqual(await operations.journeyRules());
  });
});
