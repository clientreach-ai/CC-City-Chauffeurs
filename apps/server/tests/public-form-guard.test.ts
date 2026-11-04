/**
 * The public enquiry form, against a flood it would not see coming.
 *
 * Two ways round the per-address limit were open. Any web page could make its
 * own visitors' browsers post to the form — a "simple" cross-site request
 * needs nobody's permission — so the flood came from thousands of real
 * addresses. And one IPv6 connection holds a whole /64, so a script could
 * send every request from a fresh address. What must hold: only JSON, only
 * from our own pages (or from no browser at all), and a /64 counted as one
 * visitor.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let app: { fetch: (request: Request) => Response | Promise<Response> };
let visitorOf: typeof import("../src/lib/rate-limit").visitorOf;

beforeAll(async () => {
  database = await startDatabase();
  app = (await import("../src/index")).default;
  visitorOf = (await import("../src/lib/rate-limit")).visitorOf;
}, 60_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.reset();
}, 30_000);

const enquiry = {
  name: "Eleanor Hart",
  phone: "07700 900123",
  email: "eleanor.hart@example.com",
  service: "airport-transfers",
  pickup: "Heathrow Terminal 5",
  dropoff: "Mayfair",
  date: "2027-02-14",
  time: "09:30",
  passengers: 2,
  message: "",
  website: "",
};

let caller = 0;
function send(headers: Record<string, string>, body = JSON.stringify(enquiry)) {
  return app.fetch(
    new Request("http://localhost/api/public/enquiries", {
      method: "POST",
      headers: { "x-forwarded-for": `198.51.100.${(caller += 1) % 250}`, ...headers },
      body,
    }),
  );
}

async function recorded() {
  return (await database.client.query(`select count(*)::int as n from enquiry`)).rows[0] as { n: number };
}

describe("who may post the form", () => {
  test("the website's own page may", async () => {
    const response = await send({ "Content-Type": "application/json", Origin: "http://localhost:3001" });
    expect(response.status).toBe(201);
  });

  test("something that is not a browser may, and is left to the rate limit", async () => {
    expect((await send({ "Content-Type": "application/json" })).status).toBe(201);
  });

  test("another site's page may not", async () => {
    const response = await send({ "Content-Type": "application/json", Origin: "https://elsewhere.example" });
    expect(response.status).toBe(403);
    expect(await recorded()).toEqual({ n: 0 });
  });

  test("nor a cross-site request that hides where it came from", async () => {
    const response = await send({ "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" });
    expect(response.status).toBe(403);
  });

  test("nor a body sent as anything but JSON — the kind a page can send without asking", async () => {
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]) {
      expect((await send({ "Content-Type": type, Origin: "http://localhost:3001" })).status).toBe(415);
    }
    expect(await recorded()).toEqual({ n: 0 });
  });
});

describe("one IPv6 connection", () => {
  test("counts as one visitor however many of its addresses it uses", async () => {
    const statuses = [];
    for (const host of ["1", "2", "3", "abcd:ef01:2345:6789"]) {
      const response = await send({
        "Content-Type": "application/json",
        "x-forwarded-for": `2001:db8:cafe:42::${host}`,
      });
      statuses.push(response.status);
    }
    expect(statuses).toEqual([201, 201, 201, 429]);
  });

  test("is its /64, however the address is written", () => {
    expect(visitorOf("2001:db8:cafe:42::1")).toBe("2001:db8:cafe:42::/64");
    expect(visitorOf("2001:0DB8:CAFE:0042:ffff:1:2:3")).toBe("2001:db8:cafe:42::/64");
    expect(visitorOf("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(visitorOf("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
    expect(visitorOf("::ffff:192.0.2.7")).toBe("192.0.2.7");
    expect(visitorOf("192.0.2.7")).toBe("192.0.2.7");
  });
});

test("the website may call the public routes, but never with a session", async () => {
  const preflight = await app.fetch(
    new Request("http://localhost/api/public/enquiries", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3001", "Access-Control-Request-Method": "POST" },
    }),
  );
  expect(preflight.headers.get("access-control-allow-origin")).toBe("http://localhost:3001");
  expect(preflight.headers.get("access-control-allow-credentials")).toBeNull();
});
