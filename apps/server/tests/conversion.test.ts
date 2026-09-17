/**
 * The journey from an enquiry to a booking.
 *
 * This is the workflow the office actually runs: someone asks, the office
 * quotes, the work is won, and the enquiry becomes a booking. What matters is
 * that nothing is retyped and nothing is lost on the way across — the same
 * customer, the same vehicle, the same journey, and a booking that still
 * knows which enquiry it came from.
 */

import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";

import { only, setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let operations: typeof import("../src/repositories/operations");

beforeAll(async () => {
  database = await startDatabase();
  operations = await import("../src/repositories/operations");

  await database.client.exec(`
    insert into vehicle (id, slug, name, make, model, status, specs, pricing, images, seo, suited_tags, availability, ownership)
    values ('veh-ghost', 'ghost', 'Rolls-Royce Ghost', 'Rolls-Royce', 'Ghost', 'published',
            '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, 'chauffeur', 'owned');
  `);
}, 60_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.reset();
}, 30_000);

async function wonEnquiry() {
  const enquiry = await operations.createPublicEnquiry({
    name: "Marcus Lee",
    phone: "07700 900456",
    email: "marcus.lee@example.com",
    replyBy: "phone",
    service: "weddings",
    vehicleId: "veh-ghost",
    pickup: "Claridge's",
    dropoff: "Kew Gardens",
    date: "2027-06-19",
    time: "13:00",
    passengers: 3,
    luggage: "One case",
    flight: "",
    message: "Ribbons, please.",
    submissionId: "",
    website: "",
  });

  await operations.updateEnquiryStatus(enquiry.id, "won");
  return enquiry;
}

test("a won enquiry becomes a booking that keeps everything", async () => {
  const enquiry = await wonEnquiry();
  const booking = await operations.createBookingFromEnquiry(enquiry.id);

  expect(booking.reference).toMatch(/^BKG-\d+$/);
  expect(booking.status).toBe("pending");

  // The same person, not a second copy of them.
  expect(booking.customerId).toBe(enquiry.customerId);
  expect((await database.client.query("select id from customer")).rows).toHaveLength(1);

  // The journey, carried across rather than retyped.
  expect(booking.service).toBe("weddings");
  expect(booking.vehicleId).toBe("veh-ghost");
  expect(booking.date).toBe("2027-06-19");
  expect(booking.time).toBe("13:00");
  expect(booking.pickup).toBe("Claridge's");
  expect(booking.destination).toBe("Kew Gardens");
  expect(booking.passengers).toBe(3);

  // And it still knows where it came from, in both directions.
  expect(booking.enquiryId).toBe(enquiry.id);
  const updated = only(
    (
      await database.client.query<{ booking_id: string; status: string }>(
        `select booking_id, status from enquiry where id = '${enquiry.id}'`,
      )
    ).rows,
  );
  expect(updated.booking_id).toBe(booking.id);
  expect(updated.status).toBe("won");
});

test("the same enquiry cannot be booked twice", async () => {
  const enquiry = await wonEnquiry();
  await operations.createBookingFromEnquiry(enquiry.id);

  expect(operations.createBookingFromEnquiry(enquiry.id)).rejects.toThrow();
  expect((await database.client.query("select id from booking")).rows).toHaveLength(1);
});

test("an enquiry with no date cannot become a booking", async () => {
  const enquiry = await operations.createPublicEnquiry({
    name: "Hannah Walsh",
    phone: "07700 900789",
    email: "",
    replyBy: "whatsapp",
    service: "private-chauffeur",
    vehicleId: null,
    pickup: "Knightsbridge",
    dropoff: "",
    date: "",
    time: "",
    passengers: null,
    luggage: "",
    flight: "",
    message: "Sometime next month.",
    submissionId: "",
    website: "",
  });

  await operations.updateEnquiryStatus(enquiry.id, "won");

  expect(operations.createBookingFromEnquiry(enquiry.id)).rejects.toThrow();
});

test("the office's own workflow is recorded as it happens", async () => {
  const enquiry = await wonEnquiry();
  await operations.recordQuote(enquiry.id, { amount: 1450, note: "Principal car and ribbons." });
  await operations.addEnquiryNote(enquiry.id, "Visiting the venue on Friday.", "Office");
  await operations.createBookingFromEnquiry(enquiry.id);

  const trail = (
    await database.client.query<{ kind: string }>(
      `select kind from activity_entry where enquiry_id = '${enquiry.id}' order by at`,
    )
  ).rows.map((row) => row.kind);

  expect(trail).toContain("created");
  expect(trail).toContain("status");
  expect(trail).toContain("quote");
  expect(trail).toContain("note");
  expect(trail).toContain("booking");
});

test("the same car twice in one day is shown, not refused", async () => {
  const first = await wonEnquiry();
  const morning = await operations.createBookingFromEnquiry(first.id);

  // A second journey, same car, same day — an ordinary thing, and exactly
  // what the office needs to see before it promises the car to anybody.
  const second = await operations.createPublicEnquiry({
    name: "Priya Shah",
    phone: "07700 900222",
    email: "priya.shah@example.com",
    replyBy: "phone",
    service: "airport-transfers",
    vehicleId: "veh-ghost",
    pickup: "Heathrow Terminal 5",
    dropoff: "Mayfair",
    date: "2027-06-19",
    time: "20:00",
    passengers: 2,
    luggage: "",
    flight: "BA178",
    message: "",
    submissionId: "",
    website: "",
  });
  await operations.updateEnquiryStatus(second.id, "won");
  const evening = await operations.createBookingFromEnquiry(second.id);

  const clashes = await operations.bookingClashes(morning.id);
  expect(clashes.map((booking) => booking.id)).toEqual([evening.id]);

  // Cancelling one takes it out of the way.
  await operations.updateBookingStatus(evening.id, "cancelled");
  expect(await operations.bookingClashes(morning.id)).toHaveLength(0);
});

test("a different day, or no car chosen, is not a clash", async () => {
  const enquiry = await wonEnquiry();
  const booking = await operations.createBookingFromEnquiry(enquiry.id);

  const elsewhere = await operations.createPublicEnquiry({
    name: "Marcus Lee",
    phone: "07700 900456",
    email: "marcus.lee@example.com",
    replyBy: "phone",
    service: "weddings",
    vehicleId: "veh-ghost",
    pickup: "Claridge's",
    dropoff: "Kew Gardens",
    date: "2027-06-20",
    time: "13:00",
    passengers: 3,
    luggage: "",
    flight: "",
    message: "",
    submissionId: "",
    website: "",
  });
  await operations.updateEnquiryStatus(elsewhere.id, "won");
  await operations.createBookingFromEnquiry(elsewhere.id);

  expect(await operations.bookingClashes(booking.id)).toHaveLength(0);
});
