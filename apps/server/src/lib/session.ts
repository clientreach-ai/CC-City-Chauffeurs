import { auth } from "@CC-City-Chauffeurs/auth";
import { can } from "@CC-City-Chauffeurs/core";
import type { Capability, MemberStatus, Role } from "@CC-City-Chauffeurs/core";
import { db, schema } from "@CC-City-Chauffeurs/db";
import { env } from "@CC-City-Chauffeurs/env/server";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

import { ForbiddenError, UnauthorisedError } from "./errors";

/**
 * Who is asking, and what they may do.
 *
 * The admin hides controls a role cannot use, but hiding is not enforcing:
 * every write goes through `requires()` here, so the same rule holds for a
 * request made by hand.
 */

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
};

export type Variables = { user: SessionUser | null };

/**
 * Who a better-auth session says is asking, or null for nobody.
 *
 * A member who is not `active` is treated as signed out even while holding a
 * session. Deactivating someone deletes their sessions, so this is the second
 * lock rather than the first: it covers a session that outlived the delete by
 * a moment, and anything that changes the status without going through the
 * Team routes. The status is read with the session on every request, so it
 * costs nothing extra.
 */
export function sessionUser(raw: unknown): SessionUser | null {
  const user = raw as (SessionUser & { role?: Role; status?: MemberStatus }) | null | undefined;
  if (!user) return null;
  // A row from before statuses existed reads as active, as the migration made it.
  if ((user.status ?? "active") !== "active") return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    // A user created before roles existed can still sign in; they get
    // the least privileged role rather than none at all.
    role: user.role ?? "editor",
  };
}

/** Reads the session cookie, if there is one. Never rejects. */
export const withSession = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", sessionUser(session?.user));
  await next();
});

/** Everything behind this needs a signed-in user. */
export const requireUser = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const user = c.get("user");
  if (!user) throw new UnauthorisedError();
  noteActivity(user.id);
  await next();
});

/**
 * How stale "last active" on the Team page may be. Writing it on every
 * request would put a write behind every read the admin makes; once in five
 * minutes answers the only question anyone asks of it — is this person still
 * using the admin?
 */
const ACTIVITY_EVERY_MS = 5 * 60_000;

/** When each user was last written, so most requests skip the database entirely. */
const lastNoted = new Map<string, number>();

/**
 * Records that this user is using the admin. Fire-and-forget: it is a
 * courtesy on the Team page, so it never delays a request and a failure is
 * swallowed rather than turning a successful read into an error.
 *
 * The in-memory map spares the database; the `where` clause is what keeps a
 * second API instance, or a restart that forgot the map, from writing more
 * often than the interval.
 */
function noteActivity(userId: string) {
  const now = Date.now();
  if (now - (lastNoted.get(userId) ?? 0) < ACTIVITY_EVERY_MS) return;
  lastNoted.set(userId, now);
  const stale = new Date(now - ACTIVITY_EVERY_MS);
  void db
    .update(schema.user)
    // `updatedAt` is left as it was: using the admin is not editing the account.
    .set({ lastActiveAt: new Date(now), updatedAt: sql`${schema.user.updatedAt}` })
    .where(
      and(
        eq(schema.user.id, userId),
        or(isNull(schema.user.lastActiveAt), lt(schema.user.lastActiveAt, stale)),
      ),
    )
    .catch(() => {
      // Let the next request try again rather than waiting out the interval.
      lastNoted.delete(userId);
    });
}

/** Everything behind this needs a specific capability. */
export function requires(capability: Capability) {
  return createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const user = c.get("user");
    if (!user) throw new UnauthorisedError();
    if (!can(user.role, capability)) throw new ForbiddenError();
    await next();
  });
}

/** The author recorded against a note or an activity line. */
export function authorName(user: SessionUser | null) {
  return user?.name || user?.email || "Admin";
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Refuses a write that a browser made on another site's behalf.
 *
 * The session cookie is `SameSite=None`, so any page a signed-in member of
 * staff has open can make their browser send it here. A JSON request would be
 * stopped by CORS, but a plain form post needs no preflight and `c.req.json()`
 * parses whatever arrives — so without this, a hostile page could take a
 * booking or rewrite a customer in the office's name.
 *
 * Browsers always say where a cross-site request came from, so an `Origin`
 * that is not one of ours is refused. A request with no `Origin` did not come
 * from a browser page, and carries no cookie it did not already own.
 */
export const sameSiteWrites = createMiddleware(async (c, next) => {
  if (UNSAFE.has(c.req.method)) {
    const origin = c.req.header("origin")?.replace(/\/+$/, "");
    const crossSite = c.req.header("sec-fetch-site") === "cross-site";
    if ((origin && !env.CORS_ORIGIN.includes(origin)) || (!origin && crossSite)) {
      throw new ForbiddenError("This request did not come from the admin.");
    }
  }
  await next();
});

/**
 * Whether this user may change what the website shows.
 *
 * The save routes need only `content.edit`, but their bodies carry the
 * record's `status` (or a band's `visible`) because the editor form sends the
 * whole record. Without this, an editor could publish — or take down — a page
 * by saving it with a different status, and the `content.publish` check on
 * the status routes would never be reached. For a role that cannot publish,
 * a new record starts as a draft and an existing one keeps what it had.
 */
export function mayPublish(c: Context<{ Variables: Variables }>) {
  const user = c.get("user");
  return user != null && can(user.role, "content.publish");
}
