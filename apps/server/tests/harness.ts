/**
 * A real Postgres for the tests to run against.
 *
 * These tests are about what the database actually does — a unique index
 * refusing a second submission, a sequence handing out each reference once, a
 * foreign key holding a booking to its customer. A stubbed database proves
 * none of that; it only proves the stub agrees with itself. PGlite is
 * Postgres compiled to WebAssembly, so the schema, the constraints and the
 * SQL are the real ones, in process, with nothing to install.
 *
 * The repositories import the `db` singleton from `@CC-City-Chauffeurs/db`,
 * so the module is replaced before any of them is loaded. Everything the
 * package exports has to be replaced together, because the first import wins.
 */

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { mock } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Straight to the source rather than through the package, whose entry point
// builds the real connection pool the moment it is imported.
import * as schema from "../../../packages/db/src/schema/index";

const MIGRATIONS = join(import.meta.dir, "../../../packages/db/src/migrations");

/** The real migrations, in order, exactly as they will run in production. */
async function migrate(client: PGlite) {
  const files = (await readdir(MIGRATIONS)).filter((name) => name.endsWith(".sql")).sort();

  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS, file), "utf8");
    // drizzle writes one file per migration with its statements separated by
    // this marker; PGlite wants them one at a time.
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await client.exec(trimmed);
    }
  }
}

export type TestDatabase = Awaited<ReturnType<typeof startDatabase>>;

export async function startDatabase() {
  const client = new PGlite();
  await migrate(client);

  const db = drizzle(client, { schema });

  /**
   * The package exports a pool and a retry helper as well as the database
   * itself. Nothing under test uses them directly, but the module has to
   * present the same shape or an import of it fails.
   */
  mock.module("@CC-City-Chauffeurs/db", () => ({
    db,
    schema,
    createDb: () => db,
    pool: { on() {}, query: () => Promise.reject(new Error("not used in tests")) },
    withConnectionRetry: <T>(attempt: () => Promise<T>) => attempt(),
  }));

  return {
    client,
    db,
    /** Empties the operational tables between tests, leaving the schema alone. */
    async reset() {
      await client.exec(`
        truncate table activity_entry, enquiry_note, booking, enquiry, customer restart identity cascade;
        alter sequence enquiry_reference_seq restart with 1100;
        alter sequence booking_reference_seq restart with 2100;
      `);
    },
    async stop() {
      await client.close();
    },
  };
}

/**
 * The environment the API expects to find. These are never used to reach
 * anything: the database is replaced above, and no test signs in.
 */
export function setTestEnvironment() {
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
  process.env.BETTER_AUTH_SECRET ??= "a-test-secret-that-is-long-enough-to-pass";
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  process.env.CORS_ORIGIN ??= "http://localhost:3001";
  process.env.SITE_URL ??= "http://localhost:3001";
  process.env.API_URL ??= "http://localhost:3000";
  process.env.NODE_ENV = "test";
}
