import { env } from "@CC-City-Chauffeurs/env/server";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema";

/**
 * The connection to Postgres.
 *
 * `drizzle(url)` builds a pool with the driver's defaults, and those defaults
 * are wrong for Neon: it closes an idle connection after about five minutes,
 * and a pooled client that has been hung up on surfaces the next query as
 * "Connection terminated unexpectedly" — a 500 on a page the visitor did
 * nothing wrong to reach. So the pool is built by hand, it retires its own
 * connections before Neon can, and a dropped one is retried once rather than
 * shown to anybody.
 */

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  /**
   * One server, three surfaces, and Neon counts connections. Ten is far more
   * than this traffic needs and well inside what the plan allows.
   */
  max: 10,
  /**
   * Under Neon's own idle cutoff, so *we* close the connection while it is
   * still ours to close. A connection retired here is invisible; one Neon
   * retires becomes an error on somebody's next request.
   */
  idleTimeoutMillis: 30_000,
  /** A cold Neon compute takes a moment to wake; ten seconds covers it. */
  connectionTimeoutMillis: 10_000,
  /**
   * Keeps NAT and load balancers between here and Neon from quietly dropping
   * a connection they think has gone away.
   */
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

/**
 * An idle client failing is a background event with nobody to throw to, and
 * an unhandled 'error' on an EventEmitter takes the process down with it.
 * The pool discards the client itself; all this has to do is not crash.
 */
pool.on("error", (error) => {
  console.error("[db] idle client error — the pool will replace it", error);
});

/** Postgres and libpq codes that mean "the connection went away", not "the query was wrong". */
const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "08000", // connection_exception
  "08003", // connection_does_not_exist
  "08006", // connection_failure
  "57P01", // admin_shutdown — Neon retiring the compute
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now — the compute is still waking
]);

const TRANSIENT_MESSAGES = [
  "connection terminated",
  "connection ended unexpectedly",
  "socket hang up",
  "server closed the connection unexpectedly",
  "timeout exceeded when trying to connect",
];

function isTransient(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  if (code && TRANSIENT_CODES.has(code)) return true;
  const message = error.message.toLowerCase();
  return TRANSIENT_MESSAGES.some((phrase) => message.includes(phrase));
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `attempt` again once if the first go failed because the connection
 * died. Only worth doing for work that had not committed: a dropped
 * connection rolls back whatever was in flight, so the retry starts from the
 * same place the first attempt did.
 */
export async function withConnectionRetry<T>(attempt: () => Promise<T>): Promise<T> {
  try {
    return await attempt();
  } catch (error) {
    if (!isTransient(error)) throw error;
    // Long enough for the pool to hand out a fresh connection, short enough
    // that the visitor reads it as the page being slow rather than broken.
    await wait(250);
    return attempt();
  }
}

/**
 * Every statement drizzle issues outside a transaction goes through
 * `pool.query`, so retrying here covers all of the reads and the writes that
 * are a single statement — without another layer wrapped round drizzle for
 * callers to remember to use. Transactions are deliberately left alone:
 * whether a lost connection took the COMMIT with it is not knowable from
 * here, and the public writes that matter guard themselves with a submission
 * id instead.
 */
type Query = (...args: unknown[]) => Promise<unknown>;
const issue = pool.query.bind(pool) as Query;
pool.query = ((...args: unknown[]) =>
  // The driver's callback form returns void, so it is passed straight
  // through; drizzle only ever uses the promise form.
  typeof args.at(-1) === "function"
    ? issue(...args)
    : withConnectionRetry(() => issue(...args))) as typeof pool.query;

export function createDb() {
  return drizzle(pool, { schema });
}

export const db = createDb();
export { pool, schema };
export type Database = ReturnType<typeof createDb>;
