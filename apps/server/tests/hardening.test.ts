/**
 * The doors the public and the admin come through, held shut.
 *
 * Each of these was found open: a day that does not exist accepted into the
 * diary, a car id from a visitor's browser that later made a booking fail,
 * and an admin write another website could make a signed-in browser send.
 */

import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { CmsValidationError } from "@CC-City-Chauffeurs/core";
import { bookingInputSchema, publicEnquirySchema } from "@CC-City-Chauffeurs/core/schemas";
import { Hono } from "hono";

import { setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let operations: typeof import("../src/repositories/operations");

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

const visitor = { name: "Priya Shah", phone: "07700 900321" };

test("a day that does not exist is refused on both forms", () => {
  for (const date of ["2027-02-31", "2027-13-01", "2027-00-10"]) {
    expect(publicEnquirySchema.safeParse({ ...visitor, date }).success).toBe(false);
    expect(bookingInputSchema.safeParse({ ...visitor, date }).success).toBe(false);
  }
  expect(publicEnquirySchema.safeParse({ ...visitor, date: "2028-02-29" }).success).toBe(true);
});

test("the public form refuses a date that has passed, as the website does", () => {
  expect(publicEnquirySchema.safeParse({ ...visitor, date: "2001-01-01" }).success).toBe(false);
  expect(publicEnquirySchema.safeParse({ ...visitor, date: "" }).success).toBe(true);
});

test("passengers are between 1 and 50", () => {
  for (const passengers of [0, -5, 51, 100_000]) {
    expect(publicEnquirySchema.safeParse({ ...visitor, passengers }).success).toBe(false);
  }
  expect(publicEnquirySchema.safeParse({ ...visitor, passengers: 4 }).success).toBe(true);
});

test("a car the fleet does not have is dropped from an enquiry, which still converts", async () => {
  const enquiry = await operations.createPublicEnquiry(
    publicEnquirySchema.parse({ ...visitor, vehicleId: "no-such-car", date: "2030-06-01" }),
  );
  expect(enquiry.journey.vehicleId).toBeNull();

  const booking = await operations.createBookingFromEnquiry(enquiry.id);
  expect(booking.vehicleId).toBeNull();
});

test("a telephone booking for a car the fleet does not have is refused, not a crash", async () => {
  const input = bookingInputSchema.parse({ ...visitor, date: "2030-06-01", vehicleId: "no-such-car" });
  await expect(operations.createBooking(input)).rejects.toBeInstanceOf(CmsValidationError);
});

test("an admin write from another site is refused", async () => {
  const { sameSiteWrites } = await import("../src/lib/session");
  const { errorResponse } = await import("../src/lib/errors");
  const app = new Hono()
    .onError(errorResponse)
    .use(sameSiteWrites)
    .post("/write", (c) => c.text("done"))
    .get("/read", (c) => c.text("done"));

  const post = async (headers: Record<string, string>) =>
    (await app.request("/write", { method: "POST", headers, body: "{}" })).status;

  expect(await post({ Origin: "https://evil.example" })).toBe(403);
  expect(await post({ "Sec-Fetch-Site": "cross-site" })).toBe(403);
  expect(await post({ Origin: "http://localhost:3001" })).toBe(200);
  // No browser, no cookie it did not already hold.
  expect(await post({})).toBe(200);
  expect((await app.request("/read", { headers: { Origin: "https://evil.example" } })).status).toBe(200);
});
