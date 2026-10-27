import { acceptInvitationSchema } from "@CC-City-Chauffeurs/core/schemas";
import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";

import { invitationBodyLimit, invitationRateLimit } from "../lib/rate-limit";
import { sameSiteWrites } from "../lib/session";
import * as team from "../repositories/team";

/**
 * Accepting an invitation, from the link in the email.
 *
 * Mounted at /api/public/invitations because the person opening it has no
 * session — that is the point of it. The token in the path is the only
 * credential, so:
 *
 * - both routes are rate limited per address, on counters of their own;
 * - the accept is a write, so it gets the same Origin check as the admin's
 *   writes (the accept page is served from the admin);
 * - nothing is cached anywhere, since the answer changes the moment the link
 *   is used;
 * - the path is kept out of the request log (see `index.ts`).
 *
 *   GET  /api/public/invitations/:token          → { name, email }, or 410
 *   POST /api/public/invitations/:token/accept   { password } → 204, or 410 / 422
 */

/** A token is 43 characters; anything far from that is not one, and is not looked up. */
function tokenOf(c: Context) {
  const token = c.req.param("token") ?? "";
  if (token.length < 20 || token.length > 100) {
    throw new HTTPException(410, {
      message: "This invitation link is invalid or has expired. Ask an admin to send a new one.",
    });
  }
  return token;
}

/**
 * A log line with every invitation token replaced. The token is the whole of
 * the credential until it is used, and a log is read by more people, and kept
 * for longer, than an inbox.
 */
export const redactInvitationTokens = (line: string) => line.replace(/(\/invitations\/)[^/\s?#]+/g, "$1[token]");

export const invitationRoutes = new Hono()
  .use(invitationRateLimit)
  .use(async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  })

  .get("/:token", async (c) => c.json(await team.previewInvitation(tokenOf(c))))

  .post("/:token/accept", sameSiteWrites, invitationBodyLimit, async (c) => {
    const token = tokenOf(c);
    const { password } = acceptInvitationSchema.parse(await c.req.json());
    await team.acceptInvitation(token, password);
    return c.body(null, 204);
  });
