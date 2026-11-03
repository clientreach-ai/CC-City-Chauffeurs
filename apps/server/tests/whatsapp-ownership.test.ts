/**
 * Whose enquiry it is, as WhatsApp sees it.
 *
 * Customers are matched by email before telephone, and nothing on a public
 * form proves an email address belongs to whoever typed it. So someone could
 * get in first with another person's email and their own number: every
 * enquiry that person made afterwards would be filed under a customer
 * carrying the stranger's number — and the stranger, writing on WhatsApp,
 * could read them, walk the sequential references, and cancel them.
 *
 * What must hold: what makes a record someone's is the number on the record
 * itself, matched in full — never the customer it happens to be filed under,
 * and never just the last ten digits.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let operations: typeof import("../src/repositories/operations");

const AMELIA = "07700 900321";
const AMELIA_ON_WHATSAPP = "+447700900321";
const STRANGER = "+447700900999";
const EMAIL = "amelia@example.test";

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

function enquiry(source: "whatsapp" | "website", over: Record<string, unknown>) {
  return operations.createPublicEnquiry(
    {
      name: "Amelia Hughes",
      phone: AMELIA,
      email: EMAIL,
      replyBy: "whatsapp",
      service: "weddings",
      vehicleId: "",
      pickup: "Claridge's",
      dropoff: "Kew Gardens",
      date: "2027-06-19",
      time: "10:00",
      passengers: 3,
      luggage: "",
      flight: "",
      message: "",
      submissionId: "",
      website: "",
      ...over,
    } as Parameters<typeof operations.createPublicEnquiry>[0],
    { source },
  );
}

/** The stranger gets in first, with Amelia's email and their own number; then Amelia enquires. */
async function squatted(source: "whatsapp" | "website") {
  const decoy = await enquiry("website", { name: "A Hughes", phone: STRANGER, message: "Just looking." });
  const hers = await enquiry(source, {});
  // The precondition: her enquiry really was filed under the stranger's customer record.
  expect(hers.customerId).toBe(decoy.customerId);
  return hers;
}

describe("an enquiry filed under a customer someone else created", () => {
  test("is not readable from that someone's number — only from hers", async () => {
    const hers = await squatted("website");
    expect(await operations.enquiryForPhone(hers.reference, STRANGER)).toBeNull();
    expect((await operations.enquiryForPhone(hers.reference, AMELIA_ON_WHATSAPP))?.id).toBe(hers.id);
  });

  test("nor is the booking made from it", async () => {
    const hers = await squatted("website");
    const booking = await operations.createBookingFromEnquiry(hers.id);
    expect(await operations.bookingForPhone(booking.reference, STRANGER)).toBeNull();
    expect((await operations.bookingForPhone(booking.reference, AMELIA_ON_WHATSAPP))?.id).toBe(booking.id);
  });

  test("and a WhatsApp one is neither listed for them nor theirs to change", async () => {
    const hers = await squatted("whatsapp");
    expect(await operations.whatsappEnquiriesForPhone(STRANGER)).toEqual([]);
    expect(await operations.whatsappEnquiryForPhone(hers.reference, STRANGER)).toBeNull();
    expect((await operations.whatsappEnquiriesForPhone(AMELIA_ON_WHATSAPP)).map((item) => item.id)).toEqual([hers.id]);
  });
});

test("the whole number decides, not its last ten digits", async () => {
  // +1 771 234 5678 and +44 7712 345678 both end in 7712345678.
  const made = await enquiry("website", { phone: "07712 345678", email: "" });
  expect(await operations.enquiryForPhone(made.reference, "+17712345678")).toBeNull();
  expect((await operations.enquiryForPhone(made.reference, "+447712345678"))?.id).toBe(made.id);
});

test("a number that is not a real one matches nothing", () => {
  expect(operations.isSendersNumber("not a number", "+447700900321")).toBe(false);
  expect(operations.isSendersNumber("", "+447700900321")).toBe(false);
  expect(operations.isSendersNumber(AMELIA, "+44")).toBe(false);
});
