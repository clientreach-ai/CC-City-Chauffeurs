import { auth } from "@CC-City-Chauffeurs/auth";
import { can } from "@CC-City-Chauffeurs/core";
import type { Capability, Role } from "@CC-City-Chauffeurs/core";
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
