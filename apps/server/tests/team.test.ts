/**
 * The team, and the invitations that bring someone into it.
 *
 * What must hold: only an admin changes the team; an invitation is a link
 * that works once, for one person, for a week, and nobody but them learns the
 * password it sets; there is always an active admin; and someone switched
 * off is signed out and stays out — however the request was made.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { InvitationIssued, InvitationPreview, TeamMember } from "@CC-City-Chauffeurs/core";
import { Hono } from "hono";

import { only, setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let team: typeof import("../src/repositories/team");
let mail: typeof import("../src/lib/mail");
let auth: typeof import("@CC-City-Chauffeurs/auth").auth;
let session: typeof import("../src/lib/session");
let app: Hono;

/** The signed-in admin every stand-in session belongs to: a real row, so the rules can see them. */
const ADMIN = { id: "admin-1", name: "Faheem", email: "faheem@example.test" };

beforeAll(async () => {
  database = await startDatabase();
  team = await import("../src/repositories/team");
  mail = await import("../src/lib/mail");
  auth = (await import("@CC-City-Chauffeurs/auth")).auth;
  session = await import("../src/lib/session");

  const { teamRoutes } = await import("../src/routes/team");
  const { invitationRoutes } = await import("../src/routes/invitations");
  const { errorResponse } = await import("../src/lib/errors");

  app = new Hono();
  app.onError((error, c) => errorResponse(error, c));
  // The admin routes behind a stand-in session: the role comes from a header.
  const admin = new Hono<{ Variables: { user: unknown } }>()
    .use(async (c, next) => {
      const role = c.req.header("x-test-role");
      const id = c.req.header("x-test-user") ?? ADMIN.id;
      c.set("user", role ? { ...ADMIN, id, image: null, role } : null);
      await next();
    })
    .route("/", teamRoutes as unknown as Hono);
  app.route("/api/admin", admin);
  app.route("/api/public/invitations", invitationRoutes);
}, 60_000);

afterAll(async () => {
  mail.useMailer(null);
  await database.stop();
});

beforeEach(async () => {
  await database.client.exec(`truncate table "user" cascade;`);
  await database.client.query(
    `insert into "user" (id, name, email, role, status, email_verified) values ($1, $2, $3, 'admin', 'active', true)`,
    [ADMIN.id, ADMIN.name, ADMIN.email],
  );
  mail.useMailer(new mail.SilentMailer());
});

// ------------------------------------------------------------------ helpers

/** Each request from its own address, so the per-address limit never decides a test by accident. */
let address = 0;
const fromSomewhere = () => ({ "x-forwarded-for": `198.51.100.${(address++ % 250) + 1}` });

const call = (method: string, path: string, role: string | null = "admin", body?: unknown, user?: string) =>
  app.request(`/api/admin${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(role ? { "x-test-role": role } : {}),
      ...(user ? { "x-test-user": user } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const invite = async (name = "Amelia Hughes", email = "amelia@example.test", role = "editor") => {
  const response = await call("POST", "/team", "admin", { name, email, role });
  expect(response.status).toBe(201);
  return (await response.json()) as InvitationIssued;
};

/** The token rides in the fragment, which a browser never sends. */
const tokenOf = (link: string) => new URLSearchParams(new URL(link).hash.slice(1)).get("token")!;

const post = (path: string, body: unknown, headers: Record<string, string> = fromSomewhere()) =>
  app.request(`/api/public/invitations/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const preview = (token: string) => post("lookup", { token });

const accept = (token: string, password = "a-long-enough-password") => post("accept", { token, password });

const rows = async <T>(query: string, params: unknown[] = []) =>
  (await database.client.query<T>(query, params)).rows;

/** An active member who has signed in before: a user row and a password. */
async function activeMember(id: string, role = "editor") {
  await database.client.query(
    `insert into "user" (id, name, email, role, status, email_verified) values ($1, $1, $1 || '@example.test', $2, 'active', true)`,
    [id, role],
  );
  await database.client.query(
    `insert into account (id, issuer, account_id, provider_id, user_id, password, updated_at)
     values ($1 || '-account', 'local:credential', $1, 'credential', $1, 'not-a-real-hash', now())`,
    [id],
  );
}

// ------------------------------------------------------------------ permissions

describe("who may do what", () => {
  test("anyone signed in may read the team; only an admin may change it", async () => {
    // Signed out is refused for every /api/admin route by `requireUser` in index.ts.
    for (const role of ["editor", "manager", "admin"]) {
      expect((await call("GET", "/team", role)).status).toBe(200);
    }

    const body = { name: "Amelia Hughes", email: "amelia@example.test", role: "editor" };
    expect((await call("POST", "/team", null, body)).status).toBe(401);
    expect((await call("POST", "/team", "editor", body)).status).toBe(403);
    expect((await call("POST", "/team", "manager", body)).status).toBe(403);

    expect((await call("PATCH", `/team/${ADMIN.id}`, "manager", { role: "editor" })).status).toBe(403);
    expect((await call("POST", `/team/${ADMIN.id}/invitation`, "manager")).status).toBe(403);
    expect((await call("DELETE", `/team/${ADMIN.id}`, "manager")).status).toBe(403);

    // Nothing was made by any of the refused requests.
    expect(await rows(`select id from "user"`)).toEqual([{ id: ADMIN.id }]);
  });

  test("a malformed body is refused before it reaches the rules", async () => {
    expect((await call("POST", "/team", "admin", { name: "X", email: "x@example.test", role: "owner" })).status).toBe(422);
    expect((await call("PATCH", `/team/${ADMIN.id}`, "admin", {})).status).toBe(422);
  });
});

// ------------------------------------------------------------------ inviting

describe("inviting someone", () => {
  test("makes an invited member with a link, and says the email did not go when mail is off", async () => {
    const issued = await invite("  Amelia Hughes ", "  Amelia@Example.TEST ");
    expect(issued.emailed).toBe(false);
    expect(issued.member).toMatchObject({
      name: "Amelia Hughes",
      email: "amelia@example.test",
      role: "editor",
      status: "invited",
      lastActiveAt: null,
    });
    expect(issued.member.invitationExpiresAt).toEqual(expect.any(String));
    const days = (Date.parse(issued.member.invitationExpiresAt!) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);

    expect(issued.link.startsWith("https://admin.example/accept-invite#token=")).toBe(true);
    const token = tokenOf(issued.link);
    expect(token.length).toBe(43);
    // Nothing a server would see — the path and the query — carries it.
    const { pathname, search } = new URL(issued.link);
    expect(pathname + search).toBe("/accept-invite");

    // Only the hash is kept: the token itself is nowhere in the database.
    const [stored] = await rows<{ token_hash: string; invited_by: string }>(`select token_hash, invited_by from team_invitation`);
    expect(stored!.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored!.token_hash).not.toContain(token);
    expect(stored!.invited_by).toBe(ADMIN.id);

    // No password exists until they choose one.
    expect(await rows(`select id from account`)).toEqual([]);
  });

  test("emails the link to them when mail is on, and reports a failed send without failing", async () => {
    const post = new mail.MemoryMailer();
    mail.useMailer(post);

    const issued = await invite("Amelia Hughes", "amelia@example.test", "manager");
    expect(issued.emailed).toBe(true);
    const sent = only(post.sent, "email");
    expect(sent.to).toBe("amelia@example.test");
    expect(sent.subject).toBe("You're invited to the City Chauffeurs admin");
    expect(sent.text).toContain("Faheem has invited you");
    expect(sent.text).toContain("as a Manager");
    expect(sent.text).toContain(issued.link);
    expect(sent.text).toContain("works once and expires in 7 days");
    expect(sent.subject).not.toContain(tokenOf(issued.link));

    post.failNext({ ok: false, code: "smtp_down", detail: "Connection refused" });
    const second = await invite("Ben Carter", "ben@example.test");
    expect(second.emailed).toBe(false);
    expect(second.member.status).toBe("invited");
  });

  test("an email address already on the team is refused, whatever its case", async () => {
    await invite();
    for (const email of ["amelia@example.test", "AMELIA@example.test", ADMIN.email]) {
      const response = await call("POST", "/team", "admin", { name: "Someone", email, role: "editor" });
      expect(response.status).toBe(422);
      expect(((await response.json()) as { fields: Record<string, string> }).fields.email).toBe(
        "Someone with this email address is already on the team.",
      );
    }
    expect(await rows(`select count(*)::int as n from "user"`)).toEqual([{ n: 2 }]);
  });

  test("a missing name or a malformed address is refused field by field", async () => {
    const response = await call("POST", "/team", "admin", { name: " ", email: "not-an-address", role: "editor" });
    expect(response.status).toBe(422);
    const { fields } = (await response.json()) as { fields: Record<string, string> };
    expect(fields.name).toEqual(expect.any(String));
    expect(fields.email).toEqual(expect.any(String));
  });

  test("an address sign-in would refuse is refused before anyone is invited with it", async () => {
    // Each passes a loose "looks like an email" check, and each is one
    // better-auth's sign-in rejects — an account made with it could accept
    // and then never sign in.
    for (const email of ["jo&ann@example.com", "user@müller.de", "john.@example.com", "a#b@example.co.uk"]) {
      const response = await call("POST", "/team", "admin", { name: "Someone", email, role: "editor" });
      expect(response.status).toBe(422);
      expect(((await response.json()) as { fields: Record<string, string> }).fields.email).toContain("can't be used to sign in");
    }
    expect(await rows(`select id from "user"`)).toEqual([{ id: ADMIN.id }]);

    // Ordinary addresses, including the less common ones, still go through.
    await invite("Siobhan O'Brien", "o'brien@example.ie");
    await invite("Ben Carter", "Ben.Carter+admin@Sub.Example.co.uk");
  });

  test("the team lists active, then invited, then deactivated, by name", async () => {
    await activeMember("zara");
    await activeMember("adam");
    await invite("Ben Carter", "ben@example.test");
    await team.updateMember("zara", { status: "deactivated" }, ADMIN);

    const response = await call("GET", "/team", "editor");
    const members = (await response.json()) as TeamMember[];
    expect(members.map((member) => [member.name, member.status])).toEqual([
      ["adam", "active"],
      ["Faheem", "active"],
      ["Ben Carter", "invited"],
      ["zara", "deactivated"],
    ]);
    expect(members.find((member) => member.status === "invited")!.invitationExpiresAt).toEqual(expect.any(String));
    expect(members.filter((member) => member.status !== "invited").every((member) => member.invitationExpiresAt === null)).toBe(true);
  });
});

// ------------------------------------------------------------------ the link

describe("an invitation link", () => {
  test("shows who it is for, and is never cached", async () => {
    const issued = await invite();
    const response = await preview(tokenOf(issued.link));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()) as InvitationPreview).toEqual({ name: "Amelia Hughes", email: "amelia@example.test" });
  });

  test("an unknown, malformed, expired or spent link is refused the same way", async () => {
    const issued = await invite();
    const token = tokenOf(issued.link);

    for (const wrong of ["x".repeat(43), "short", "y".repeat(101), ""]) {
      const response = await preview(wrong);
      expect(response.status).toBe(410);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(((await response.json()) as { error: string }).error).toBe(
        "This invitation link is invalid or has expired. Ask an admin to send a new one.",
      );
    }

    await database.client.exec(`update team_invitation set expires_at = now() - interval '1 minute'`);
    expect((await preview(token)).status).toBe(410);
    expect((await accept(token)).status).toBe(410);

    await database.client.exec(`update team_invitation set expires_at = now() + interval '1 day', used_at = now()`);
    expect((await preview(token)).status).toBe(410);
    expect((await accept(token)).status).toBe(410);
  });

  test("accepting sets their password the way better-auth reads it, and makes them active", async () => {
    const issued = await invite();
    const token = tokenOf(issued.link);

    const response = await accept(token, "correct horse battery staple");
    expect(response.status).toBe(204);

    const [account] = await rows<{ issuer: string; provider_id: string; account_id: string; password: string }>(
      `select issuer, provider_id, account_id, password from account where user_id = $1`,
      [issued.member.id],
    );
    expect(account).toMatchObject({ issuer: "local:credential", provider_id: "credential", account_id: issued.member.id });
    expect(account!.password).not.toContain("correct horse");
    const context = await auth.$context;
    expect(await context.password.verify({ hash: account!.password, password: "correct horse battery staple" })).toBe(true);

    const [user] = await rows<{ status: string; email_verified: boolean }>(
      `select status, email_verified from "user" where id = $1`,
      [issued.member.id],
    );
    expect(user).toEqual({ status: "active", email_verified: true });

    // Single use: the same link does nothing a second time.
    expect((await accept(token, "another-long-password")).status).toBe(410);
    expect((await preview(token)).status).toBe(410);
    const after = await rows<{ password: string }>(`select password from account where user_id = $1`, [issued.member.id]);
    expect(after[0]!.password).toBe(account!.password);
  });

  test("a short password is refused and the link stays usable", async () => {
    const issued = await invite();
    const token = tokenOf(issued.link);
    const response = await accept(token, "too-short");
    expect(response.status).toBe(422);
    expect(((await response.json()) as { fields: Record<string, string> }).fields.password).toBe("Use at least 12 characters.");
    expect((await preview(token)).status).toBe(200);
  });

  /**
   * PGlite has one connection, so these two run one after the other: this
   * proves the outcome, not the lock that produces it under real overlap.
   * `team-postgres.test.ts` runs the same race on a real Postgres.
   */
  test("the same link accepted twice: exactly one wins", async () => {
    const issued = await invite();
    const token = tokenOf(issued.link);
    const results = await Promise.all([accept(token, "first-long-password"), accept(token, "second-long-password")]);
    expect(results.map((response) => response.status).sort()).toEqual([204, 410]);
    expect(await rows(`select count(*)::int as n from account`)).toEqual([{ n: 1 }]);
  });

  test("sending again replaces the link; the old one stops working", async () => {
    const first = await invite();
    const response = await call("POST", `/team/${first.member.id}/invitation`);
    expect(response.status).toBe(200);
    const second = (await response.json()) as InvitationIssued;
    expect(second.link).not.toBe(first.link);
    expect(second.member.status).toBe("invited");

    expect((await preview(tokenOf(first.link))).status).toBe(410);
    expect((await preview(tokenOf(second.link))).status).toBe(200);
    expect(await rows(`select count(*)::int as n from team_invitation`)).toEqual([{ n: 1 }]);
  });

  test("only an invitation nobody has accepted can be sent again", async () => {
    await activeMember("adam");
    const response = await call("POST", "/team/adam/invitation");
    expect(response.status).toBe(422);
    expect((await call("POST", "/team/nobody/invitation")).status).toBe(404);
  });

  test("the accept is refused when another site's page sends it", async () => {
    const issued = await invite();
    const response = await post(
      "accept",
      { token: tokenOf(issued.link), password: "a-long-enough-password" },
      { Origin: "https://evil.example", ...fromSomewhere() },
    );
    expect(response.status).toBe(403);
    expect((await preview(tokenOf(issued.link))).status).toBe(200);
  });

  test("the token is never part of a path", async () => {
    const issued = await invite();
    const token = tokenOf(issued.link);
    // The old shape, with the token in the path, is not a route at all.
    expect((await app.request(`/api/public/invitations/${token}`)).status).toBe(404);
    expect((await app.request(`/api/public/invitations/${token}/accept`, { method: "POST" })).status).toBe(404);
    expect((await preview(token)).status).toBe(200);
  });

  test("a made-up token is refused without hashing a password", async () => {
    const context = await auth.$context;
    const hash = context.password.hash;
    let hashed = 0;
    context.password.hash = async (password: string) => {
      hashed++;
      return hash(password);
    };
    try {
      expect((await accept("z".repeat(43))).status).toBe(410);
      expect(hashed).toBe(0);

      const issued = await invite();
      expect((await accept(tokenOf(issued.link))).status).toBe(204);
      expect(hashed).toBe(1);
    } finally {
      context.password.hash = hash;
    }
  });

  test("invitees share the admin's address, so only a flood from it is cut off", async () => {
    // Every request below comes from one address, as they do in production
    // through the admin's /api rewrite. Ordinary use never comes near the
    // guard; a flood meets it.
    const headers = { "x-forwarded-for": "203.0.113.77" };
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 301; attempt++) {
      statuses.push((await post("lookup", { token: "z".repeat(43) }, headers)).status);
    }
    expect(statuses.slice(0, 300).every((status) => status === 410)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });
});

// ------------------------------------------------------------------ withdrawing

describe("withdrawing an invitation", () => {
  test("removes someone who never accepted, and nobody else", async () => {
    const issued = await invite();
    expect((await call("DELETE", `/team/${issued.member.id}`)).status).toBe(204);
    expect(await rows(`select id from "user" where id = $1`, [issued.member.id])).toEqual([]);
    expect(await rows(`select id from team_invitation`)).toEqual([]);
    expect((await preview(tokenOf(issued.link))).status).toBe(410);

    await activeMember("adam");
    const refused = await call("DELETE", "/team/adam");
    expect(refused.status).toBe(422);
    expect(((await refused.json()) as { error: string }).error).toBe(
      "Deactivate them instead — their name stays on the history they are part of.",
    );
    expect(await rows(`select id from "user" where id = 'adam'`)).toEqual([{ id: "adam" }]);
    expect((await call("DELETE", "/team/nobody")).status).toBe(404);
  });
});

// ------------------------------------------------------------------ changing

describe("changing a member", () => {
  test("a role changes; an unknown member is a 404", async () => {
    await activeMember("adam");
    const response = await call("PATCH", "/team/adam", "admin", { role: "manager" });
    expect(response.status).toBe(200);
    expect(((await response.json()) as TeamMember).role).toBe("manager");
    expect((await call("PATCH", "/team/nobody", "admin", { role: "manager" })).status).toBe(404);
  });

  test("nobody can deactivate themselves", async () => {
    await activeMember("second-admin", "admin");
    const response = await call("PATCH", `/team/${ADMIN.id}`, "admin", { status: "deactivated" });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { error: string }).error).toBe("You cannot deactivate your own account.");
    expect(await rows(`select status from "user" where id = $1`, [ADMIN.id])).toEqual([{ status: "active" }]);
  });

  test("the last active admin can be neither demoted nor deactivated", async () => {
    // Demoting yourself as the only admin.
    const demote = await call("PATCH", `/team/${ADMIN.id}`, "admin", { role: "manager" });
    expect(demote.status).toBe(422);
    expect(((await demote.json()) as { error: string }).error).toContain("at least one active admin");

    // Another admin, deactivated, does not count.
    await activeMember("dormant-admin", "admin");
    await team.updateMember("dormant-admin", { status: "deactivated" }, ADMIN);
    expect((await call("PATCH", `/team/${ADMIN.id}`, "admin", { role: "editor" })).status).toBe(422);

    // With a second active admin, the first may step down — and then the
    // second is the last, and cannot be deactivated by anyone.
    await activeMember("second-admin", "admin");
    expect((await call("PATCH", `/team/${ADMIN.id}`, "admin", { role: "manager" })).status).toBe(200);
    const last = await team.updateMember("second-admin", { role: "admin" }, ADMIN).then(() =>
      team.updateMember("second-admin", { status: "deactivated" }, ADMIN).then(
        () => null,
        (error: unknown) => error,
      ),
    );
    expect(last).toMatchObject({ message: expect.stringContaining("at least one active admin") });
    expect(await rows(`select role, status from "user" where id = 'second-admin'`)).toEqual([{ role: "admin", status: "active" }]);
  });

  /** One after the other on PGlite, as above; `team-postgres.test.ts` runs it with real overlap. */
  test("two admins demoting each other cannot leave none", async () => {
    await activeMember("second-admin", "admin");
    const results = await Promise.allSettled([
      team.updateMember("second-admin", { role: "editor" }, ADMIN),
      team.updateMember(ADMIN.id, { role: "editor" }, { id: "second-admin", name: "second-admin", email: "s@example.test" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled").length).toBe(1);
    expect(await rows(`select count(*)::int as n from "user" where role = 'admin' and status = 'active'`)).toEqual([{ n: 1 }]);
  });

  test("deactivating signs them out everywhere and withdraws any invitation", async () => {
    await activeMember("adam");
    await database.client.query(
      `insert into session (id, expires_at, token, updated_at, user_id) values
         ('s1', now() + interval '1 day', 'tok-1', now(), 'adam'),
         ('s2', now() + interval '1 day', 'tok-2', now(), 'adam'),
         ('s3', now() + interval '1 day', 'tok-3', now(), $1)`,
      [ADMIN.id],
    );

    const response = await call("PATCH", "/team/adam", "admin", { status: "deactivated" });
    expect(response.status).toBe(200);
    expect(((await response.json()) as TeamMember).status).toBe("deactivated");
    expect(await rows(`select id from session order by id`)).toEqual([{ id: "s3" }]);

    // An invited member deactivated loses their link too.
    const issued = await invite();
    await call("PATCH", `/team/${issued.member.id}`, "admin", { status: "deactivated" });
    expect((await preview(tokenOf(issued.link))).status).toBe(410);
    expect(await rows(`select id from team_invitation`)).toEqual([]);
  });

  test("reactivating someone with a password makes them active; someone without one, invited", async () => {
    await activeMember("adam");
    await team.updateMember("adam", { status: "deactivated" }, ADMIN);
    const back = await call("PATCH", "/team/adam", "admin", { status: "active" });
    expect(((await back.json()) as TeamMember).status).toBe("active");

    const issued = await invite();
    await team.updateMember(issued.member.id, { status: "deactivated" }, ADMIN);
    const reinvited = (await (await call("PATCH", `/team/${issued.member.id}`, "admin", { status: "active" })).json()) as TeamMember;
    expect(reinvited.status).toBe("invited");
    // No live link until one is sent, which the admin then does.
    expect(reinvited.invitationExpiresAt).toBeNull();
    const resent = (await (await call("POST", `/team/${issued.member.id}/invitation`)).json()) as InvitationIssued;
    expect((await accept(tokenOf(resent.link))).status).toBe(204);
  });
});

// ------------------------------------------------------------------ signing in

describe("signing in", () => {
  /**
   * A better-auth of its own, on this file's database. The module's singleton
   * was built by whichever test file imported it first, against that file's
   * database — closed by now when the whole suite runs.
   */
  let signedInAuth: ReturnType<typeof import("@CC-City-Chauffeurs/auth").createAuth>;
  beforeAll(async () => {
    signedInAuth = (await import("@CC-City-Chauffeurs/auth")).createAuth();
  });

  const signIn = (email: string, password: string) =>
    signedInAuth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
        body: JSON.stringify({ email, password }),
      }),
    );

  /** The API's own view of a session cookie: who it says is asking, if anyone. */
  async function whoIs(cookie: string) {
    const found = await signedInAuth.api.getSession({ headers: new Headers({ cookie }) });
    return session.sessionUser(found?.user);
  }

  test("an invited member cannot sign in until they accept; a deactivated one is signed out and stays out", async () => {
    const password = "a-long-enough-password";
    const issued = await invite();

    // Give the invited row a password behind the invitation's back: the
    // status alone must still refuse the session.
    const hash = await (await auth.$context).password.hash(password);
    await database.client.query(
      `insert into account (id, issuer, account_id, provider_id, user_id, password, updated_at)
       values ('pre', 'local:credential', $1, 'credential', $1, $2, now())`,
      [issued.member.id, hash],
    );
    expect((await signIn("amelia@example.test", password)).ok).toBe(false);
    expect(await rows(`select id from session`)).toEqual([]);
    await database.client.exec(`delete from account where id = 'pre'`);

    expect((await accept(tokenOf(issued.link), password)).status).toBe(204);
    const signedIn = await signIn("amelia@example.test", password);
    expect(signedIn.status).toBe(200);
    const cookie = (signedIn.headers.get("set-cookie") ?? "").split(";")[0]!;
    expect((await whoIs(cookie))?.id).toBe(issued.member.id);

    // A session that somehow outlived the deactivation is still treated as signed out.
    await database.client.query(`update "user" set status = 'deactivated' where id = $1`, [issued.member.id]);
    expect(await whoIs(cookie)).toBeNull();
    expect((await signIn("amelia@example.test", password)).ok).toBe(false);
  });

  test("the database itself refuses a session to anyone not active", async () => {
    await activeMember("adam");
    const issued = await invite();
    await activeMember("zara");
    await team.updateMember("zara", { status: "deactivated" }, ADMIN);

    const insertSession = (id: string, userId: string) =>
      database.client.query(
        `insert into session (id, expires_at, token, updated_at, user_id) values ($1, now() + interval '1 day', $1, now(), $2)`,
        [id, userId],
      );

    await insertSession("for-adam", "adam");
    // Written straight to the table, past better-auth and its hook.
    await expect(insertSession("for-invited", issued.member.id)).rejects.toThrow("Only an active member may hold a session.");
    await expect(insertSession("for-zara", "zara")).rejects.toThrow("Only an active member may hold a session.");
    expect(await rows(`select id from session order by id`)).toEqual([{ id: "for-adam" }]);
  });
});
