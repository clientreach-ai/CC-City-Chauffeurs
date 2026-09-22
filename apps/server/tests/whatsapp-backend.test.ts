/**
 * What the WhatsApp assistant may ask of the business.
 *
 * The adapter is only translation: every rule belongs to the repositories
 * the website and the admin already use. What is worth proving is exactly
 * that — an enquiry made on WhatsApp is the same record, matched to the same
 * customer and refused for the same reasons, as one made on the website; and
 * a customer asking after a reference can only ever see their own.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  type Backend,
  BackendValidationError,
  type E164,
  type RequestCustomer,
  type RequestJourney,
} from "@CC-City-Chauffeurs/whatsapp/ports";

import { only, setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let backend: Backend;

beforeAll(async () => {
  database = await startDatabase();
  backend = (await import("../src/lib/whatsapp-backend")).createWhatsAppBackend();

  await database.client.exec(`
    insert into vehicle (id, slug, name, make, model, short_description, status, specs, pricing, availability)
    values
      ('veh-cullinan', 'cullinan', 'Rolls-Royce Cullinan', 'Rolls-Royce', 'Cullinan', 'The quiet one.', 'published',
       '{"passengers":4,"luggage":"3 large cases","year":2024,"transmission":"","bodyType":""}'::jsonb,
       '{"hourlyRate":180,"dayRate":1400,"airportNote":"","notes":"Office only: owner discount."}'::jsonb,
       'chauffeur'),
      ('veh-g63', 'g63', 'Mercedes G63', 'Mercedes-AMG', 'G63', '', 'published',
       '{"passengers":null,"luggage":"","year":null,"transmission":"","bodyType":""}'::jsonb,
       '{"hourlyRate":null,"dayRate":null,"airportNote":"","notes":""}'::jsonb,
       'chauffeur-or-self-drive'),
      ('veh-draft', 'phantom', 'Rolls-Royce Phantom', 'Rolls-Royce', 'Phantom', '', 'draft',
       '{"passengers":4,"luggage":"","year":null,"transmission":"","bodyType":""}'::jsonb,
       '{"hourlyRate":250,"dayRate":null,"airportNote":"","notes":""}'::jsonb,
       'chauffeur');
    insert into fleet_category (id, slug, title, status) values
      ('cat-chauffeur', 'chauffeur', 'Chauffeur Fleet', 'published'),
      ('cat-secret', 'secret', 'Coming Soon', 'draft');
    insert into vehicle_category (vehicle_id, category_id) values
      ('veh-cullinan', 'cat-chauffeur'), ('veh-cullinan', 'cat-secret'), ('veh-g63', 'cat-chauffeur');
    insert into service (id, slug, name, summary, standfirst, benefits, booking, status, position) values
      ('svc-weddings', 'weddings', 'Weddings', 'For the day itself.', 'The car arrives early.',
       '[{"title":"Ribbons","copy":"In your colours."}]'::jsonb,
       '{"needs":["The date","The venues"],"note":""}'::jsonb, 'published', 0),
      ('svc-hidden', 'hidden', 'Hidden', '', '', '[]'::jsonb, '{"needs":[],"note":""}'::jsonb, 'draft', 1);
    insert into service_vehicle (service_id, vehicle_id, position) values
      ('svc-weddings', 'veh-draft', 0), ('svc-weddings', 'veh-cullinan', 1);
  `);
}, 60_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.reset();
}, 30_000);

const AMELIA = "+447700900321" as E164;

const customer = (over: Partial<RequestCustomer> = {}): RequestCustomer => ({
  name: "Amelia Hughes",
  phone: AMELIA,
  email: "",
  ...over,
});

const journey = (over: Partial<RequestJourney> = {}): RequestJourney => ({
  service: "weddings",
  vehicleId: "veh-cullinan",
  pickup: "The Dorchester",
  dropoff: "Chelsea Old Town Hall",
  date: "2027-05-08",
  time: "11:00",
  passengers: 4,
  luggage: "",
  flight: "",
  notes: "Ribbons, please.",
  ...over,
});

async function rows(sql: string) {
  return (await database.client.query(sql)).rows as Record<string, unknown>[];
}

describe("what the assistant can read", () => {
  test("the fleet is the published fleet, with the website's own rates", async () => {
    const fleet = await backend.listFleet();

    expect(fleet.map((vehicle) => vehicle.id).sort()).toEqual(["veh-cullinan", "veh-g63"]);
    const cullinan = fleet.find((vehicle) => vehicle.id === "veh-cullinan")!;
    expect(cullinan).toEqual({
      id: "veh-cullinan",
      slug: "cullinan",
      name: "Rolls-Royce Cullinan",
      make: "Rolls-Royce",
      model: "Cullinan",
      // A grouping still in draft is not named.
      groupings: ["Chauffeur Fleet"],
      shortDescription: "The quiet one.",
      passengers: 4,
      luggage: "3 large cases",
      chauffeurOnly: true,
      hourlyRate: 180,
      dayRate: 1400,
    });
    // The office's own pricing notes never leave.
    expect(JSON.stringify(fleet)).not.toContain("owner discount");

    const g63 = fleet.find((vehicle) => vehicle.id === "veh-g63")!;
    expect(g63.passengers).toBeNull();
    expect(g63.chauffeurOnly).toBe(false);
    expect(g63.hourlyRate).toBeNull();
  });

  test("services are the published ones, with what the office needs to quote", async () => {
    expect(await backend.listServices()).toEqual([
      { slug: "weddings", name: "Weddings", summary: "For the day itself." },
    ]);

    const weddings = await backend.getService("weddings");
    expect(weddings).toEqual({
      slug: "weddings",
      name: "Weddings",
      summary: "For the day itself.",
      standfirst: "The car arrives early.",
      benefits: [{ title: "Ribbons", copy: "In your colours." }],
      needs: ["The date", "The venues"],
      // The draft Phantom is on the service but not on the website.
      vehicleNames: ["Rolls-Royce Cullinan"],
    });

    expect(await backend.getService("hidden")).toBeNull();
    expect(await backend.getService("nothing-at-all")).toBeNull();
  });
});

describe("an enquiry made on WhatsApp", () => {
  test("is the website's enquiry, marked as come from WhatsApp", async () => {
    const { reference } = await backend.createEnquiry({
      customer: customer(),
      journey: journey({ luggage: "Two cases", flight: "BA117" }),
      submissionId: "wa:wam-1:enquiry",
    });

    expect(reference).toMatch(/^ENQ-\d+$/);
    const enquiry = only(await rows(`select * from enquiry where reference = '${reference}'`));
    expect(enquiry.source).toBe("whatsapp");
    expect(enquiry.reply_by).toBe("whatsapp");
    expect(enquiry.status).toBe("new");
    expect(enquiry.message).toBe("Ribbons, please.");
    const recorded = enquiry.journey as Record<string, unknown>;
    expect(recorded.vehicleId).toBe("veh-cullinan");
    expect(recorded.luggage).toBe("Two cases");
    expect(recorded.flight).toBe("BA117");

    const person = only(await rows(`select * from customer where id = '${enquiry.customer_id}'`));
    expect(person.name).toBe("Amelia Hughes");
    expect(person.phone).toBe(AMELIA);

    const trail = only(await rows(`select text from activity_entry where enquiry_id = '${enquiry.id}'`));
    expect(trail.text).toBe(`Enquiry ${reference} received on WhatsApp`);
  });

  test("delivered twice, is recorded once", async () => {
    const input = { customer: customer(), journey: journey(), submissionId: "wa:wam-2:enquiry" };
    const first = await backend.createEnquiry(input);
    const second = await backend.createEnquiry(input);

    expect(second.reference).toBe(first.reference);
    expect(await rows("select id from enquiry")).toHaveLength(1);
  });

  test("finds the customer the office wrote down as 07700 900321", async () => {
    await database.client.exec(`
      insert into customer (id, name, phone) values ('cus-amelia', 'Amelia Hughes', '07700 900321');
    `);

    const { reference } = await backend.createEnquiry({
      customer: customer({ phone: "+44 7700 900321" as E164 }),
      journey: journey(),
      submissionId: "wa:wam-3:enquiry",
    });

    expect(await rows("select id from customer")).toHaveLength(1);
    expect(only(await rows(`select customer_id from enquiry where reference = '${reference}'`)).customer_id).toBe(
      "cus-amelia",
    );
    expect(await backend.matchCustomer(AMELIA)).toEqual({ id: "cus-amelia", name: "Amelia Hughes" });
    expect(await backend.matchCustomer("+447700900999" as E164)).toBeNull();
  });

  test("a day that does not exist is refused in the website's own words, and nothing is written", async () => {
    const attempt = backend.createEnquiry({
      customer: customer(),
      journey: journey({ date: "2026-02-31" }),
      submissionId: "wa:wam-4:enquiry",
    });

    const error = await attempt.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BackendValidationError);
    expect((error as BackendValidationError).fields.date).toBe(
      "That date does not exist — check the day and month.",
    );
    expect(await rows("select id from enquiry")).toHaveLength(0);
    expect(await rows("select id from customer")).toHaveLength(0);
  });

  test("a refused field is named as the journey names it", async () => {
    const error = await backend
      .createEnquiry({
        customer: customer(),
        journey: journey({ notes: "x".repeat(5000) }),
        submissionId: "wa:wam-5:enquiry",
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BackendValidationError);
    expect(Object.keys((error as BackendValidationError).fields)).toEqual(["notes"]);
  });
});

describe("a booking request made on WhatsApp", () => {
  test("is pending, attached to the customer and the car, and says it is not confirmed", async () => {
    const { reference } = await backend.createBookingRequest({
      customer: customer({ email: "amelia.hughes@example.com" }),
      journey: journey({ luggage: "Two cases", flight: "BA117" }),
      submissionId: "wa:wam-6:booking",
    });

    expect(reference).toMatch(/^BKG-\d+$/);
    const booking = only(await rows(`select * from booking where reference = '${reference}'`));
    expect(booking.status).toBe("pending");
    expect(booking.vehicle_id).toBe("veh-cullinan");
    expect(booking.date).toBe("2027-05-08");
    expect(booking.destination).toBe("Chelsea Old Town Hall");
    expect(booking.enquiry_id).toBeNull();
    expect(booking.notes).toBe("Ribbons, please.\nLuggage: Two cases\nFlight: BA117");

    const person = only(await rows("select * from customer"));
    expect(booking.customer_id).toBe(person.id);

    const trail = only(await rows(`select text from activity_entry where booking_id = '${booking.id}'`));
    expect(trail.text).toBe(`Booking ${reference} requested on WhatsApp — not yet confirmed`);
  });

  test("delivered twice, asks once", async () => {
    const input = { customer: customer(), journey: journey(), submissionId: "wa:wam-7:booking" };
    const first = await backend.createBookingRequest(input);
    const second = await backend.createBookingRequest(input);

    expect(second.reference).toBe(first.reference);
    expect(await rows("select id from booking")).toHaveLength(1);
  });

  test("needs a real day, and writes nothing without one", async () => {
    const error = await backend
      .createBookingRequest({
        customer: customer(),
        journey: journey({ date: "2026-02-31" }),
        submissionId: "wa:wam-8:booking",
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BackendValidationError);
    expect((error as BackendValidationError).fields.date).toBeDefined();
    expect(await rows("select id from booking")).toHaveLength(0);
    expect(await rows("select id from customer")).toHaveLength(0);
  });

  test("a car that has left the fleet is refused by the repository's own rule", async () => {
    const error = await backend
      .createBookingRequest({
        customer: customer(),
        journey: journey({ vehicleId: "veh-gone" }),
        submissionId: "wa:wam-9:booking",
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BackendValidationError);
    expect((error as BackendValidationError).fields.vehicleId).toBeDefined();
    expect(await rows("select id from booking")).toHaveLength(0);
  });
});

describe("asking after an enquiry", () => {
  test("answers only the person whose enquiry it is", async () => {
    const { reference } = await backend.createEnquiry({
      customer: customer(),
      journey: journey(),
      submissionId: "wa:wam-10:enquiry",
    });

    const mine = await backend.findEnquiry(reference, AMELIA);
    expect(mine).toMatchObject({ reference, status: "New" });
    expect(mine?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Typed in lower case, with a space: still hers.
    expect(await backend.findEnquiry(` ${reference.toLowerCase()} `, AMELIA)).not.toBeNull();

    // Somebody else quoting her reference learns nothing — the same answer
    // as a reference that was never issued.
    expect(await backend.findEnquiry(reference, "+447700900654" as E164)).toBeNull();
    expect(await backend.findEnquiry("ENQ-99999", AMELIA)).toBeNull();
  });

  test("an enquiry recorded with the office's spelling of the number is still hers", async () => {
    await database.client.exec(`
      insert into customer (id, name, phone) values ('cus-amelia', 'Amelia Hughes', '07700 900321');
      insert into enquiry (id, reference, customer_id, contact, source, journey, status)
      values ('enq-1', 'ENQ-1042', 'cus-amelia', '{"name":"Amelia","phone":"07700 900321","email":""}'::jsonb,
              'phone', '{"service":"","vehicleId":null,"pickup":"","dropoff":"","date":"","time":"","passengers":null,"luggage":"","flight":""}'::jsonb,
              'quoted');
    `);

    expect(await backend.findEnquiry("ENQ-1042", AMELIA)).toMatchObject({ reference: "ENQ-1042", status: "Quoted" });
  });
});
