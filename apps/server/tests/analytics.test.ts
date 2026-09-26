/**
 * The counting, done by the database.
 *
 * These are the numbers a client reads off a dashboard and repeats to
 * somebody, so the tests are about arithmetic rather than shape: a quiet
 * period must draw as an empty bar rather than vanish, a conversion rate must
 * not count enquiries nobody has answered yet, and a car nobody has been
 * assigned must not appear as a car somebody asked for.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { only, setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let analytics: typeof import("../src/repositories/analytics");

beforeAll(async () => {
  database = await startDatabase();
  analytics = await import("../src/repositories/analytics");
}, 60_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.reset();
  await database.client.exec(`
    insert into vehicle (id, slug, name, make, model, status, specs)
    values ('veh-cullinan', 'cullinan', 'Rolls-Royce Cullinan', 'Rolls-Royce', 'Cullinan', 'published',
            '{"passengers":3,"luggage":"","year":null,"transmission":"","bodyType":""}'::jsonb),
           ('veh-sclass', 's-class', 'Mercedes S-Class', 'Mercedes', 'S-Class', 'published',
            '{"passengers":3,"luggage":"","year":null,"transmission":"","bodyType":""}'::jsonb)
    on conflict (id) do nothing;
  `);
}, 30_000);

/** An enquiry recorded a given number of days ago. */
async function enquiry(
  id: string,
  daysAgo: number,
  over: { source?: string; status?: string; service?: string } = {},
) {
  await database.client.exec(`
    insert into enquiry (id, reference, customer_id, contact, source, reply_by, journey, message, status, created_at, updated_at)
    values ('${id}', '${id.toUpperCase()}', null,
            '{"name":"A Customer","phone":"07700 900321","email":""}'::jsonb,
            '${over.source ?? "website"}', 'phone',
            '{"service":"${over.service ?? "airport-transfers"}"}'::jsonb,
            '', '${over.status ?? "new"}',
            now() - interval '${daysAgo} days', now() - interval '${daysAgo} days');
  `);
}

/** A booking recorded a given number of days ago. */
async function booking(
  id: string,
  daysAgo: number,
  over: { status?: string; vehicleId?: string | null } = {},
) {
  const vehicle = over.vehicleId === null ? "null" : `'${over.vehicleId ?? "veh-cullinan"}'`;
  await database.client.exec(`
    insert into booking (id, reference, customer_id, enquiry_id, service, vehicle_id, date, time, pickup, destination, passengers, notes, status, created_at, updated_at)
    values ('${id}', '${id.toUpperCase()}', null, null, '', ${vehicle}, '2027-05-01', '19:00', 'Heathrow', 'Mayfair', 2, '',
            '${over.status ?? "pending"}', now() - interval '${daysAgo} days', now() - interval '${daysAgo} days');
  `);
}

describe("the shape over time", () => {
  test("every period in the window is present, including the quiet ones", async () => {
    await enquiry("enq-1", 0);

    const { buckets } = await analytics.getAnalytics("day");

    // Thirty days, whatever happened in them: a fortnight with no enquiries
    // has to draw as empty bars, not close the gap and mislead.
    expect(buckets).toHaveLength(30);
    expect(buckets.at(-1)).toMatchObject({ enquiries: 1 });
    expect(buckets.filter((bucket) => bucket.enquiries === 0)).toHaveLength(29);
    // Oldest first, so the chart reads left to right.
    expect([...buckets].sort((a, b) => a.start.localeCompare(b.start))).toEqual(buckets);
  });

  test("each grain counts into its own periods", async () => {
    await enquiry("enq-1", 0);
    await enquiry("enq-2", 40);

    expect((await analytics.getAnalytics("day")).buckets).toHaveLength(30);
    expect((await analytics.getAnalytics("week")).buckets).toHaveLength(12);
    expect((await analytics.getAnalytics("month")).buckets).toHaveLength(12);
    expect((await analytics.getAnalytics("year")).buckets).toHaveLength(5);

    // Forty days ago is outside the daily window and inside the monthly one.
    const daily = await analytics.getAnalytics("day");
    const monthly = await analytics.getAnalytics("month");
    expect(daily.buckets.reduce((sum, bucket) => sum + bucket.enquiries, 0)).toBe(1);
    expect(monthly.buckets.reduce((sum, bucket) => sum + bucket.enquiries, 0)).toBe(2);
  });

  test("enquiries and bookings are counted apart", async () => {
    await enquiry("enq-1", 1);
    await booking("bkg-1", 1);
    await booking("bkg-2", 1);

    const { buckets } = await analytics.getAnalytics("day");
    const yesterday = buckets.at(-2)!;
    expect(yesterday).toMatchObject({ enquiries: 1, bookings: 2 });
  });
});

describe("the headline", () => {
  test("counts what is in the window, and what the office has confirmed", async () => {
    await enquiry("enq-1", 1);
    await enquiry("enq-2", 2);
    await booking("bkg-1", 1, { status: "confirmed" });
    await booking("bkg-2", 2, { status: "pending" });

    const { headline } = await analytics.getAnalytics("month");
    expect(headline).toMatchObject({ enquiries: 2, bookings: 2, confirmed: 1 });
  });

  test("conversion counts only the enquiries that were decided", async () => {
    await enquiry("enq-won", 1, { status: "won" });
    await enquiry("enq-lost", 1, { status: "lost" });
    // Still open: not a failure to convert, just unanswered.
    await enquiry("enq-new", 1, { status: "new" });

    expect((await analytics.getAnalytics("month")).headline.conversion).toBe(50);
  });

  test("is honest about having nothing to say", async () => {
    const { headline, buckets } = await analytics.getAnalytics("month");

    expect(headline).toMatchObject({ enquiries: 0, bookings: 0, confirmed: 0 });
    // No enquiry decided either way means no rate, not a nought.
    expect(headline.conversion).toBeNull();
    expect(buckets).toHaveLength(12);
  });
});

describe("the slices", () => {
  test("where the enquiries came from, most first", async () => {
    await enquiry("enq-1", 1, { source: "whatsapp" });
    await enquiry("enq-2", 1, { source: "whatsapp" });
    await enquiry("enq-3", 1, { source: "website" });

    const { sources } = await analytics.getAnalytics("month");
    expect(sources[0]).toEqual({ label: "Whatsapp", value: 2 });
    expect(sources[1]).toEqual({ label: "Website", value: 1 });
  });

  test("the cars asked for, by the name the office reads", async () => {
    await booking("bkg-1", 1, { vehicleId: "veh-sclass" });
    await booking("bkg-2", 1, { vehicleId: "veh-sclass" });
    await booking("bkg-3", 1, { vehicleId: "veh-cullinan" });
    // Nobody has been given a car for this one yet.
    await booking("bkg-4", 1, { vehicleId: null });

    const { vehicles } = await analytics.getAnalytics("month");
    expect(vehicles).toEqual([
      { label: "Mercedes S-Class", value: 2 },
      { label: "Rolls-Royce Cullinan", value: 1 },
    ]);
  });

  test("a service nobody named reads as something, not as blank", async () => {
    await enquiry("enq-1", 1, { service: "" });

    expect((await analytics.getAnalytics("month")).services[0]).toEqual({ label: "Not said", value: 1 });
  });

  test("a slug reads as words", async () => {
    await enquiry("enq-1", 1, { service: "airport-transfers" });

    expect((await analytics.getAnalytics("month")).services[0]!.label).toBe("Airport transfers");
  });
});

describe("what it costs to ask", () => {
  test("the answer is a few dozen numbers, whatever the table holds", async () => {
    for (let index = 0; index < 60; index += 1) await enquiry(`enq-${index}`, index % 20);

    const answer = await analytics.getAnalytics("day");

    // Nothing here grows with the number of enquiries: thirty buckets, and a
    // handful of slices, however many rows were counted.
    expect(answer.buckets).toHaveLength(30);
    expect(answer.services.length).toBeLessThanOrEqual(6);
    expect(answer.vehicles.length).toBeLessThanOrEqual(6);
    expect(only(answer.sources.filter((slice) => slice.label === "Website")).value).toBe(60);
  });
});
