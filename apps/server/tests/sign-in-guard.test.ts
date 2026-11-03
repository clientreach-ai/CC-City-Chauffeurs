/**
 * Guessing a password, through the dashboard.
 *
 * Every admin request reaches the API from one of Vercel's addresses, a
 * different one each time, so better-auth's per-address limit never fills
 * there. What must hold is a limit per account: a few wrong passwords for an
 * email address and that account refuses more for a while, whichever address
 * the attempts come from — and a correct password, before then, clears it.
 *
 * better-auth's own per-address limiter is off under NODE_ENV=test, so
 * nothing here is decided by it.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { Hono } from "hono";

import { setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let guard: typeof import("../src/lib/sign-in-guard");
let app: Hono;

const EMAIL = "faheem@example.test";
const PASSWORD = "the-right-password";

beforeAll(async () => {
  database = await startDatabase();
  guard = await import("../src/lib/sign-in-guard");
  const { authBodyLimit } = await import("../src/lib/rate-limit");
  // A better-auth of this file's own, on this file's database — see password.test.ts.
  const auth = (await import("@CC-City-Chauffeurs/auth")).createAuth();

  // Wired exactly as src/index.ts wires it.
  app = new Hono();
  app.use("/api/auth/*", authBodyLimit);
  app.use("/api/auth/sign-in/email", guard.signInGuard);
  app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  await database.client.exec(`truncate table "user" cascade;`);
  for (const [id, email] of [
    ["admin-1", EMAIL],
    ["admin-2", "other@example.test"],
  ]) {
    await database.client.query(
      `insert into "user" (id, name, email, role, status, email_verified) values ($1, $1, $2, 'admin', 'active', true)`,
      [id, email],
    );
    const hash = await (await auth.$context).password.hash(PASSWORD);
    await database.client.query(
      `insert into account (id, issuer, account_id, provider_id, user_id, password, updated_at)
       values ($1 || '-account', 'local:credential', $1, 'credential', $1, $2, now())`,
      [id, hash],
    );
  }
}, 60_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(() => guard.resetSignInFailures());
afterEach(() => setSystemTime());

/** Each attempt from a fresh address, as Vercel's rewrite delivers them. */
let address = 0;
const signIn = (email: string, password: string) =>
  app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3002",
      "x-forwarded-for": `203.0.113.${(address++ % 250) + 1}`,
    },
    body: JSON.stringify({ email, password }),
  });

async function wrong(times: number, email = EMAIL) {
  for (let attempt = 0; attempt < times; attempt++) expect((await signIn(email, "a-wrong-guess")).status).toBe(401);
}

describe("wrong passwords for one account", () => {
  test("lock it, whichever address they come from — even against the right password", async () => {
    await wrong(guard.MAX_FAILURES);
    const locked = await signIn(EMAIL, PASSWORD);
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(((await locked.json()) as { code: string }).code).toBe("TOO_MANY_ATTEMPTS");
  });

  test("count the address however it is typed", async () => {
    await wrong(guard.MAX_FAILURES, "FAHEEM@Example.test");
    expect((await signIn(EMAIL, PASSWORD)).status).toBe(429);
  });

  test("leave every other account alone", async () => {
    await wrong(guard.MAX_FAILURES);
    expect((await signIn("other@example.test", PASSWORD)).status).toBe(200);
  });

  test("are forgotten by a correct password before the limit", async () => {
    await wrong(guard.MAX_FAILURES - 1);
    expect((await signIn(EMAIL, PASSWORD)).status).toBe(200);
    await wrong(guard.MAX_FAILURES - 1);
    expect((await signIn(EMAIL, PASSWORD)).status).toBe(200);
  });

  test("stop counting once they are old enough", async () => {
    const start = Date.now();
    setSystemTime(new Date(start));
    await wrong(guard.MAX_FAILURES);
    expect((await signIn(EMAIL, PASSWORD)).status).toBe(429);
    setSystemTime(new Date(start + guard.FAILURE_WINDOW_MS + 1_000));
    expect((await signIn(EMAIL, PASSWORD)).status).toBe(200);
  });
});

test("a body far larger than sign-in sends is refused before better-auth reads it", async () => {
  const response = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3002" },
    body: JSON.stringify({ email: EMAIL, password: "x".repeat(64 * 1024) }),
  });
  expect(response.status).toBe(413);
});
