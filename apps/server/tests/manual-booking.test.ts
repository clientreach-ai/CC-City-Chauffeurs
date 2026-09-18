/**
 * A booking taken over the telephone.
 *
 * The office's own way in: somebody rings, the journey is agreed, and it goes
 * in the diary there and then. What is worth proving is that it is the same
 * diary and the same customers as everything else — a telephone booking that
 * quietly made a second copy of a regular customer would be worse than no
 * telephone booking at all.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { only, setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let app: { fetch: (request: Request) => Response | Promise<Response> };
let operations: typeof import("../src/repositories/operations");

beforeAll(async () => {
  database = await startDatabase();
  app = (await import("../src/index")).default;
  operations = await import("../src/repositories/operations");

  await database.client.exec(`
    insert into vehicle (id, slug, name, make, model, status, specs, pricing, images, seo, suited_tags, availability, ownership)
    values ('veh-cullinan', 'cullinan', 'Rolls-Royce Cullinan', 'Rolls-Royce', 'Cullinan', 'published',
            '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, 'chauffeur', 'owned');
  `);
}, 60_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.reset();
}, 30_000);

const taken = (over: Record<string, unknown> = {}) => ({
  name: "Amelia Hughes",
  phone: "07700 900321",
  email: "amelia.hughes@example.com",
  service: "weddings",
  vehicleId: "veh-cullinan",
  date: "2027-05-08",
  time: "11:00",
  pickup: "The Dorchester",
  dropoff: "Chelsea Old Town Hall",
  passengers: 4,
  notes: "Ribbons. Photographer travelling with the party.",
  ...over,
});

async function rows(sql: string) {
  return (await database.client.query(sql)).rows as Record<string, unknown>[];
}

describe("taking a booking by telephone", () => {
  test("writes the journey, the customer and the trail in one go", async () => {
    const booking = await operations.createBooking(taken() as never);

    expect(booking.reference).toMatch(/^BKG-\d+$/);
    expect(booking.status).toBe("pending");
    expect(booking.enquiryId).toBeNull();
    expect(booking.service).toBe("weddings");
    expect(booking.vehicleId).toBe("veh-cullinan");
    expect(booking.date).toBe("2027-05-08");
    expect(booking.time).toBe("11:00");
    expect(booking.pickup).toBe("The Dorchester");
    expect(booking.destination).toBe("Chelsea Old Town Hall");
    expect(booking.passengers).toBe(4);

    const customer = only(await rows("select * from customer"));
    expect(customer.name).toBe("Amelia Hughes");
    expect(booking.customerId).toBe(customer.id as string);

    // The trail says where it came from, because a booking with no enquiry
    // behind it otherwise looks like one somebody lost the paperwork for.
    const trail = only(await rows(`select text from activity_entry where booking_id = '${booking.id}'`));
    expect(trail.text).toContain("taken by the office");
  });

  test("goes in as confirmed when the office says it is", async () => {
    const booking = await operations.createBooking(taken({ status: "confirmed" }) as never);
    expect(booking.status).toBe("confirmed");
  });

  test("finds the customer the business already has, however the number is written", async () => {
    await operations.createBooking(taken() as never);
    // The same woman, ringing again, the number taken down differently and no
    // address this time.
    await operations.createBooking(
      taken({ phone: "+44 7700 900321", email: "", date: "2027-07-02" }) as never,
    );

    expect(await rows("select id from customer")).toHaveLength(1);
    expect(await rows("select id from booking")).toHaveLength(2);
  });

  test("keeps the same customer across a telephone booking and a website enquiry", async () => {
    await operations.createBooking(taken() as never);
    await operations.createPublicEnquiry({
      name: "Amelia Hughes",
      phone: "07700 900321",
      email: "",
      replyBy: "phone",
      service: "airport-transfers",
      vehicleId: null,
      pickup: "Heathrow",
      dropoff: "",
      date: "",
      time: "",
      passengers: null,
      luggage: "",
      flight: "",
      message: "",
      submissionId: "",
      website: "",
    });

    expect(await rows("select id from customer")).toHaveLength(1);
  });

  test("keeps the name even when no number or address is given", async () => {
    // The office was made to type a name. Losing it because the caller did
    // not leave a number would throw away the only thing it was told, and the
    // booking would show no customer at all.
    const booking = await operations.createBooking(taken({ phone: "", email: "" }) as never);

    const customer = only(await rows("select * from customer"));
    expect(customer.name).toBe("Amelia Hughes");
    expect(booking.customerId).toBe(customer.id as string);
  });

  test("still records nothing for a website enquiry with no way to reply", async () => {
    // The public form is the other way round: no address and no number means
    // nothing to match on next time, so no customer is invented.
    await operations.createPublicEnquiry({
      name: "Nobody Reachable",
      phone: "",
      email: "",
      replyBy: "whatsapp",
      service: "",
      vehicleId: null,
      pickup: "",
      dropoff: "",
      date: "",
      time: "",
      passengers: null,
      luggage: "",
      flight: "",
      message: "",
      submissionId: "",
      website: "",
    });

    expect(await rows("select id from customer")).toHaveLength(0);
  });

  test("gives out references nobody else has", async () => {
    const made = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        operations.createBooking(taken({ email: `person${index}@example.com`, phone: "" }) as never),
      ),
    );
    expect(new Set(made.map((booking) => booking.reference)).size).toBe(8);
  });
});

describe("what the office is not allowed to save", () => {
  const post = (body: unknown) =>
    app.fetch(
      new Request("http://localhost/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

  test("refuses a booking with no date", async () => {
    await expect(operations.createBooking(taken({ date: "" }) as never)).rejects.toThrow();
  });

  test("refuses to take one from nobody signed in", async () => {
    expect((await post(taken())).status).toBe(401);
    expect(await rows("select id from booking")).toHaveLength(0);
  });

  test("refuses to show the clash preview to nobody signed in", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/admin/bookings/clashes?vehicleId=veh-cullinan&date=2027-05-08"),
    );
    expect(response.status).toBe(401);
  });
});

describe("the clash preview, before the booking exists", () => {
  test("names what that car is already carrying that day", async () => {
    const morning = await operations.createBooking(taken() as never);

    const clashes = await operations.clashesFor("veh-cullinan", "2027-05-08");
    expect(clashes.map((booking) => booking.id)).toEqual([morning.id]);
  });

  test("says nothing when no car is chosen, or the day is free", async () => {
    await operations.createBooking(taken() as never);

    expect(await operations.clashesFor(null, "2027-05-08")).toHaveLength(0);
    expect(await operations.clashesFor("veh-cullinan", "")).toHaveLength(0);
    expect(await operations.clashesFor("veh-cullinan", "2027-05-09")).toHaveLength(0);
  });

  test("leaves out the booking being edited, and anything cancelled", async () => {
    const first = await operations.createBooking(taken() as never);
    const second = await operations.createBooking(taken({ time: "19:00" }) as never);

    expect(await operations.clashesFor("veh-cullinan", "2027-05-08", first.id)).toHaveLength(1);

    await operations.updateBookingStatus(second.id, "cancelled");
    expect(await operations.clashesFor("veh-cullinan", "2027-05-08", first.id)).toHaveLength(0);
  });
});

describe("who the booking is attached to", () => {
  test("does not mistake one number for another that merely ends the same way", async () => {
    // The fault this replaced: +441123123123, 07123123123 and a bare
    // 123123123 all end in the same nine digits. Matching on nine made them
    // one person, and the office watched the name it had just typed turn
    // into a stranger's.
    await operations.createBooking(taken({ name: "John Will", phone: "+441123123123", email: "" }) as never);

    for (const typed of ["123123123", "0123123123", "+44123123123", "07123123123"]) {
      expect(await operations.customerMatch(typed, "")).toBeNull();
    }

    const booking = await operations.createBooking(
      taken({ name: "Sarah Jones", phone: "07123123123", email: "", date: "2027-09-01" }) as never,
    );
    const customer = only(
      await rows(`select name from customer where id = '${booking.customerId}'`),
    );
    expect(customer.name).toBe("Sarah Jones");
    expect(await rows("select id from customer")).toHaveLength(2);
  });

  test("still knows one telephone written two ways", async () => {
    await operations.createBooking(taken({ phone: "07700 900321", email: "" }) as never);

    const match = await operations.customerMatch("+44 7700 900321", "");
    expect(match?.name).toBe("Amelia Hughes");

    await operations.createBooking(
      taken({ name: "A. Hughes", phone: "+44 7700 900321", email: "", date: "2027-09-02" }) as never,
    );
    expect(await rows("select id from customer")).toHaveLength(1);
  });

  test("says who it found before anything is saved, and nothing when it finds nobody", async () => {
    await operations.createBooking(taken() as never);

    expect((await operations.customerMatch("", "amelia.hughes@example.com"))?.name).toBe("Amelia Hughes");
    expect(await operations.customerMatch("07700 111222", "")).toBeNull();
    expect(await operations.customerMatch("", "")).toBeNull();
  });
});
