import { auth } from "@CC-City-Chauffeurs/auth";
import { can } from "@CC-City-Chauffeurs/core";
import type { Capability, Role } from "@CC-City-Chauffeurs/core";
import { env } from "@CC-City-Chauffeurs/env/server";
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

/** Reads the session cookie, if there is one. Never rejects. */
export const withSession = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const user = session?.user as (SessionUser & { role?: Role }) | undefined;
  c.set(
    "user",
    user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image ?? null,
          // A user created before roles existed can still sign in; they get
          // the least privileged role rather than none at all.
          role: user.role ?? "editor",
        }
      : null,
  );
  await next();
});

/** Everything behind this needs a signed-in user. */
export const requireUser = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  if (!c.get("user")) throw new UnauthorisedError();
  await next();
});

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
