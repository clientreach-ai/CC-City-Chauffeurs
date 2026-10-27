/**
 * The team's guarantees under real concurrency.
 *
 * Every other test runs on PGlite, which has one connection: two
 * transactions sent "at once" run one after the other, so it can show the
 * outcome of a race but never that a lock is what decides it. These run on a
 * real Postgres, where they genuinely overlap. Each race is pinned open by a
 * third connection holding the lock both sides need, released only once
 * Postgres reports both waiting — so the overlap is certain, not lucky.
 *
 * Opt-in, and run on its own (the database module is replaced once per
 * process, and the other files replace it with PGlite):
 *
 *   docker run --rm -d --name team-pg -p 55432:5432 -e POSTGRES_PASSWORD=test postgres:16-alpine
 *   TEST_POSTGRES_URL=postgresql://postgres:test@localhost:55432/postgres bun test tests/team-postgres.test.ts
 *
 * It drops and recreates the database's public schema, so it refuses any
 * host but this machine.
 */

import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import type { Pool, PoolClient } from "pg";

import { migrate, setTestEnvironment } from "./harness";

const URL_ = process.env.TEST_POSTGRES_URL;

describe.skipIf(!URL_)("the team, on a real Postgres", () => {
  let pool: Pool;
  let team: typeof import("../src/repositories/team");

  const ADMIN = { id: "admin-1", name: "Faheem", email: "faheem@example.test" };

  beforeAll(async () => {
    const host = new URL(URL_!).hostname;
    if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
      throw new Error(`TEST_POSTGRES_URL must point at this machine; it wipes the schema. Got ${host}.`);
    }
    setTestEnvironment();

    const pg = (await import("pg")).default;
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const schema = await import("@CC-City-Chauffeurs/db/schema/index");

    pool = new pg.Pool({ connectionString: URL_, max: 10 });
    await pool.query("drop schema public cascade; create schema public;");
    await migrate({ exec: (sql) => pool.query(sql) });

    const db = drizzle(pool, { schema });
    mock.module("@CC-City-Chauffeurs/db", () => ({
      db,
      schema,
      createDb: () => db,
      pool,
      withConnectionRetry: <T>(attempt: () => Promise<T>) => attempt(),
    }));
    team = await import("../src/repositories/team");
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  async function fresh() {
    await pool.query(`truncate table "user" cascade`);
    await pool.query(
      `insert into "user" (id, name, email, role, status, email_verified) values ($1, $2, $3, 'admin', 'active', true)`,
      [ADMIN.id, ADMIN.name, ADMIN.email],
    );
  }

  async function activeMember(id: string, role = "editor") {
    await pool.query(
      `insert into "user" (id, name, email, role, status, email_verified) values ($1, $1, $1 || '@example.test', $2, 'active', true)`,
      [id, role],
    );
  }

  /** Waits until this many other backends are queued on a lock. */
  async function waitingOnLocks(count: number) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const { rows } = await pool.query<{ n: number }>(
        `select count(*)::int as n from pg_stat_activity where wait_event_type = 'Lock' and datname = current_database()`,
      );
      if (rows[0]!.n >= count) return;
      await Bun.sleep(25);
    }
    throw new Error(`Expected ${count} waiting on a lock; they never queued.`);
  }

  /** A connection holding `lock` open in a transaction until `release()`. */
  async function hold(lock: string, params: unknown[]) {
    const client: PoolClient = await pool.connect();
    await client.query("begin");
    await client.query(lock, params);
    return {
      client,
      async release() {
        await client.query("commit");
        client.release();
      },
    };
  }

  test("the same link accepted twice at the same moment: exactly one wins", async () => {
    await fresh();
    const issued = await team.inviteMember({ name: "Amelia Hughes", email: "amelia@example.test", role: "editor" }, ADMIN);
    const token = new URLSearchParams(new URL(issued.link).hash.slice(1)).get("token")!;

    const gate = await hold(`select id from "user" where id = $1 for update`, [issued.member.id]);
    const race = Promise.allSettled([
      team.acceptInvitation(token, "first-long-password"),
      team.acceptInvitation(token, "second-long-password"),
    ]);
    await waitingOnLocks(2);
    await gate.release();

    const results = await race;
    expect(results.filter((result) => result.status === "fulfilled").length).toBe(1);
    const { rows } = await pool.query(`select count(*)::int as n from account where user_id = $1`, [issued.member.id]);
    expect(rows).toEqual([{ n: 1 }]);
  });

  test("two admins demoting each other at the same moment cannot leave none", async () => {
    await fresh();
    await activeMember("second-admin", "admin");

    const gate = await hold(`select id from "user" where role = 'admin' order by id for update`, []);
    const race = Promise.allSettled([
      team.updateMember("second-admin", { role: "editor" }, ADMIN),
      team.updateMember(ADMIN.id, { role: "editor" }, { id: "second-admin", name: "second-admin", email: "s@example.test" }),
    ]);
    await waitingOnLocks(2);
    await gate.release();

    const results = await race;
    expect(results.filter((result) => result.status === "fulfilled").length).toBe(1);
    const { rows } = await pool.query(`select count(*)::int as n from "user" where role = 'admin' and status = 'active'`);
    expect(rows).toEqual([{ n: 1 }]);
  });

  test("a sign-in landing while they are being deactivated gets no session", async () => {
    await fresh();
    await activeMember("adam");

    // The deactivation, mid-flight: the member locked, switched off and
    // signed out, not yet committed — exactly what `updateMember` does.
    const deactivation = await hold(`select id from "user" where id = $1 for update`, ["adam"]);
    await deactivation.client.query(`update "user" set status = 'deactivated' where id = 'adam'`);
    await deactivation.client.query(`delete from session where user_id = 'adam'`);

    // better-auth's hook already said yes; this is the insert that follows it.
    const signIn = pool.query(
      `insert into session (id, expires_at, token, updated_at, user_id) values ('late', now() + interval '1 day', 'late', now(), 'adam')`,
    );
    await waitingOnLocks(1);
    await deactivation.release();

    await expect(signIn).rejects.toThrow("Only an active member may hold a session.");
    const { rows } = await pool.query(`select id from session where user_id = 'adam'`);
    expect(rows).toEqual([]);
  });

  test("a deactivation landing while they sign in still signs them out", async () => {
    await fresh();
    await activeMember("adam");

    // The sign-in, mid-flight: its session written, not yet committed.
    const signIn = await hold(
      `insert into session (id, expires_at, token, updated_at, user_id) values ('early', now() + interval '1 day', 'early', now(), $1)`,
      ["adam"],
    );
    const deactivation = team.updateMember("adam", { status: "deactivated" }, ADMIN);
    await waitingOnLocks(1);
    await signIn.release();

    expect((await deactivation).status).toBe("deactivated");
    const { rows } = await pool.query(`select id from session where user_id = 'adam'`);
    expect(rows).toEqual([]);
  });
});
