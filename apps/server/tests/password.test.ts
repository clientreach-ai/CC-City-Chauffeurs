/**
 * Changing your own password, from the admin's account page.
 *
 * The admin calls better-auth's own `/change-password`, so what is tested
 * here is the configuration that makes it ours: the same length rule an
 * invitation applies, the current password required, every other device
 * signed out while this one stays signed in, and the old password dead.
 *
 * Not tested here: the Origin check that refuses another site's page.
 * better-auth switches it off under NODE_ENV=test, which every test runs
 * with; it is on in development and production.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { PASSWORD_LENGTH, validatePasswordChange } from "@CC-City-Chauffeurs/core";

import { setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
/**
 * A better-auth of its own, on this file's database. The module's singleton
 * was built by whichever test file imported it first, against that file's
 * database — closed by now when the whole suite runs.
 */
let auth: ReturnType<typeof import("@CC-City-Chauffeurs/auth").createAuth>;

const ORIGIN = "http://localhost:3002";
const EMAIL = "faheem@example.test";
const PASSWORD = "the-original-password";

beforeAll(async () => {
  database = await startDatabase();
  auth = (await import("@CC-City-Chauffeurs/auth")).createAuth();
}, 60_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.client.exec(`truncate table "user" cascade;`);
  await database.client.query(
    `insert into "user" (id, name, email, role, status, email_verified) values ('admin-1', 'Faheem', $1, 'admin', 'active', true)`,
    [EMAIL],
  );
  const hash = await (await auth.$context).password.hash(PASSWORD);
  await database.client.query(
    `insert into account (id, issuer, account_id, provider_id, user_id, password, updated_at)
     values ('admin-1-account', 'local:credential', 'admin-1', 'credential', 'admin-1', $1, now())`,
    [hash],
  );
});

const request = (path: string, body: unknown, cookie?: string) =>
  auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );

/** Signs in and hands back the session cookie, or null when refused. */
async function signIn(password: string) {
  const response = await request("/sign-in/email", { email: EMAIL, password });
  return response.ok ? (response.headers.get("set-cookie") ?? "").split(";")[0]! : null;
}

const changePassword = (cookie: string, currentPassword: string, newPassword: string) =>
  request("/change-password", { currentPassword, newPassword, revokeOtherSessions: true }, cookie);

async function signedIn(cookie: string) {
  return (await auth.api.getSession({ headers: new Headers({ cookie }) }))?.user.id ?? null;
}

describe("changing your password", () => {
  test("needs the current password; a wrong one changes nothing", async () => {
    const cookie = (await signIn(PASSWORD))!;
    const response = await changePassword(cookie, "not-the-password", "a-brand-new-password");
    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe("INVALID_PASSWORD");
    expect(await signIn(PASSWORD)).not.toBeNull();
    expect(await signIn("a-brand-new-password")).toBeNull();
  });

  test("holds a new password to the same length rule as an invitation", async () => {
    const cookie = (await signIn(PASSWORD))!;
    const short = await changePassword(cookie, PASSWORD, "x".repeat(PASSWORD_LENGTH.min - 1));
    expect(((await short.json()) as { code: string }).code).toBe("PASSWORD_TOO_SHORT");
    const long = await changePassword(cookie, PASSWORD, "x".repeat(PASSWORD_LENGTH.max + 1));
    expect(((await long.json()) as { code: string }).code).toBe("PASSWORD_TOO_LONG");
    expect((await changePassword(cookie, PASSWORD, "x".repeat(PASSWORD_LENGTH.min))).status).toBe(200);
  });

  test("the new password signs in, the old one no longer does", async () => {
    const cookie = (await signIn(PASSWORD))!;
    expect((await changePassword(cookie, PASSWORD, "a-brand-new-password")).status).toBe(200);
    expect(await signIn(PASSWORD)).toBeNull();
    expect(await signIn("a-brand-new-password")).not.toBeNull();
  });

  test("every other device is signed out; this one carries on with a fresh session", async () => {
    const here = (await signIn(PASSWORD))!;
    const elsewhere = (await signIn(PASSWORD))!;
    const response = await changePassword(here, PASSWORD, "a-brand-new-password");
    expect(response.status).toBe(200);

    expect(await signedIn(elsewhere)).toBeNull();
    const fresh = (response.headers.get("set-cookie") ?? "").split(";")[0]!;
    expect(fresh).not.toBe("");
    expect(await signedIn(fresh)).toBe("admin-1");
    const sessions = await database.client.query(`select id from session where user_id = 'admin-1'`);
    expect(sessions.rows).toHaveLength(1);
  });

  test("needs a session; nobody changes a password by knowing it alone", async () => {
    const response = await request("/change-password", {
      currentPassword: PASSWORD,
      newPassword: "a-brand-new-password",
    });
    expect(response.status).toBe(401);
    expect(await signIn(PASSWORD)).not.toBeNull();
  });
});

describe("the account page's own checks", () => {
  const input = (patch: Partial<Parameters<typeof validatePasswordChange>[0]>) => ({
    currentPassword: PASSWORD,
    newPassword: "a-brand-new-password",
    confirmPassword: "a-brand-new-password",
    ...patch,
  });

  test("a complete, matching change passes", () => {
    expect(validatePasswordChange(input({}))).toEqual({});
  });

  test("each problem is reported against its own field", () => {
    expect(validatePasswordChange(input({ currentPassword: "" })).currentPassword).toBeDefined();
    expect(validatePasswordChange(input({ newPassword: "short", confirmPassword: "short" })).newPassword).toBe(
      `Use at least ${PASSWORD_LENGTH.min} characters.`,
    );
    expect(validatePasswordChange(input({ newPassword: PASSWORD, confirmPassword: PASSWORD })).newPassword).toBe(
      "Choose a password different from your current one.",
    );
    expect(validatePasswordChange(input({ confirmPassword: "something-else-entirely" })).confirmPassword).toBe(
      "The two new passwords do not match.",
    );
    expect(validatePasswordChange(input({ confirmPassword: "" })).confirmPassword).toBeDefined();
  });
});
