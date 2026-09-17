/**
 * The path a customer's request actually takes.
 *
 * Every test here goes through the running API — the real routes, the real
 * validation, the real repositories — against a real Postgres. What is being
 * checked is the thing the office depends on: that a request made on the
 * website exists afterwards, once, attached to the right person.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { only, setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let app: { fetch: (request: Request) => Response | Promise<Response> };

beforeAll(async () => {
  database = await startDatabase();
  // Imported only now: the module graph reaches the database on the way in,
  // and the replacement above has to be in place first.
  app = (await import("../src/index")).default;
}, 60_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.reset();
}, 30_000);

/** Each test speaks from its own address, so the rate limit stays out of the way. */
let caller = 0;
function post(path: string, body: unknown, ip = `203.0.113.${(caller += 1) % 250}`) {
  return app.fetch(
    new Request(`http://localhost/api/public${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

const enquiry = (over: Record<string, unknown> = {}) => ({
  name: "Eleanor Hart",
  phone: "07700 900123",
  email: "eleanor.hart@example.com",
  service: "airport-transfers",
  pickup: "Heathrow Terminal 5",
  dropoff: "Mayfair",
  date: "2027-02-14",
  time: "09:30",
  passengers: 2,
  message: "Two large cases.",
  website: "",
  ...over,
});

async function rows(sql: string) {
  const result = await database.client.query(sql);
  return result.rows as Record<string, unknown>[];
}

describe("an enquiry from the website", () => {
  test("is recorded, with a reference and a customer", async () => {
    const response = await post("/enquiries", enquiry());
    expect(response.status).toBe(201);

    const { reference } = (await response.json()) as { reference: string };
    expect(reference).toMatch(/^ENQ-\d+$/);

    const record = only(await rows(`select * from enquiry where reference = '${reference}'`));
    expect(record).toBeDefined();
    expect(record.status).toBe("new");
    expect(record.source).toBe("website");

    const customer = only(await rows(`select * from customer where id = '${record.customer_id}'`));
    expect(customer.name).toBe("Eleanor Hart");
    expect(customer.email).toBe("eleanor.hart@example.com");

    // The office reads the trail to see where a record came from.
    const trail = await rows(`select * from activity_entry where enquiry_id = '${record.id}'`);
    expect(trail).toHaveLength(1);
  });

  test("keeps the vehicle the visitor chose", async () => {
    await database.client.exec(`
      insert into vehicle (id, slug, name, make, model, status, specs, pricing, images, seo, suited_tags, availability, ownership)
      values ('veh-cullinan', 'cullinan', 'Rolls-Royce Cullinan', 'Rolls-Royce', 'Cullinan', 'published',
              '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, 'chauffeur', 'owned');
    `);

    const response = await post("/enquiries", enquiry({ vehicleId: "veh-cullinan" }));
    const { reference } = (await response.json()) as { reference: string };

    const record = only(await rows(`select journey from enquiry where reference = '${reference}'`));
    expect((record.journey as { vehicleId: string }).vehicleId).toBe("veh-cullinan");
  });

  test("attaches a second enquiry to the same customer", async () => {
    await post("/enquiries", enquiry());
    await post("/enquiries", enquiry({ pickup: "Gatwick", message: "A different journey." }));

    expect(await rows("select id from customer")).toHaveLength(1);
    expect(await rows("select id from enquiry")).toHaveLength(2);
  });

  test("matches a returning customer on their telephone number alone", async () => {
    await post("/enquiries", enquiry());
    // The same person, a different address, the number written differently.
    await post("/enquiries", enquiry({ email: "", phone: "+44 7700 900123" }));

    expect(await rows("select id from customer")).toHaveLength(1);
  });

  test("records nothing twice when the same submission is sent again", async () => {
    const submissionId = "b6f1c2de-0000-4000-8000-000000000001";

    const first = await post("/enquiries", enquiry({ submissionId }));
    const second = await post("/enquiries", enquiry({ submissionId }));

    const one = (await first.json()) as { reference: string };
    const two = (await second.json()) as { reference: string };

    expect(two.reference).toBe(one.reference);
    expect(await rows("select id from enquiry")).toHaveLength(1);
    expect(await rows("select id from customer")).toHaveLength(1);
  });

  test("gives every reference out only once, however fast they arrive", async () => {
    const submissions = Array.from({ length: 12 }, (_, index) =>
      post("/enquiries", enquiry({ email: `person${index}@example.com`, phone: "" })),
    );

    const references = await Promise.all(
      (await Promise.all(submissions)).map(async (response) => {
        expect(response.status).toBe(201);
        return ((await response.json()) as { reference: string }).reference;
      }),
    );

    expect(new Set(references).size).toBe(12);
  });
});

describe("what the form is not allowed to send", () => {
  test("refuses a missing name, and says which field", async () => {
    const response = await post("/enquiries", enquiry({ name: "" }));
    expect(response.status).toBe(422);

    const body = (await response.json()) as { error: string; fields: Record<string, string> };
    expect(body.fields.name).toBeTruthy();
    expect(await rows("select id from enquiry")).toHaveLength(0);
  });

  test("refuses an oversized message", async () => {
    const response = await post("/enquiries", enquiry({ message: "x".repeat(2100) }));
    expect(response.status).toBe(422);
    expect(((await response.json()) as { fields: Record<string, string> }).fields.message).toBeTruthy();
  });

  test("refuses an address that is not one", async () => {
    const response = await post("/enquiries", enquiry({ email: "eleanor at example" }));
    expect(response.status).toBe(422);
  });

  test("records nothing when the honeypot is filled, and says nothing about it", async () => {
    const response = await post("/enquiries", enquiry({ website: "https://example.com" }));

    expect(response.status).toBe(201);
    expect(((await response.json()) as { reference: string }).reference).toBe("");
    expect(await rows("select id from enquiry")).toHaveLength(0);
  });

  test("turns away a flood from one address", async () => {
    const ip = "198.51.100.7";
    const responses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push((await post("/enquiries", enquiry({ phone: "", email: "" }), ip)).status);
    }

    expect(responses).toContain(429);
    // The ones it did accept still landed.
    expect((await rows("select id from enquiry")).length).toBe(
      responses.filter((status) => status === 201).length,
    );
  });
});

describe("the website's write surface", () => {
  test("offers exactly one way in, and no way to create a booking", async () => {
    // A booking is something the office agrees to, not something a visitor
    // can put in the diary. The only public write is the enquiry.
    const response = await post("/bookings", enquiry());
    expect(response.status).toBe(404);
    expect(await rows("select id from booking")).toHaveLength(0);
  });
});

describe("the admin surface", () => {
  const admin = (path: string, method = "GET") =>
    app.fetch(new Request(`http://localhost/api/admin${path}`, { method }));

  test("refuses to show operational records to nobody in particular", async () => {
    for (const path of ["/enquiries", "/bookings", "/customers", "/overview", "/settings"]) {
      const response = await admin(path);
      expect(response.status).toBe(401);
    }
  });

  test("refuses writes just as firmly", async () => {
    expect((await admin("/vehicles", "POST")).status).toBe(401);
    expect((await admin("/enquiries/enq-1/status", "PATCH")).status).toBe(401);
  });
});
