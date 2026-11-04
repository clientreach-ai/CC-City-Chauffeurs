import { acceptInvitationSchema, invitationLookupSchema } from "@CC-City-Chauffeurs/core/schemas";
import { Hono } from "hono";

import { invitationBodyLimit, invitationRateLimit } from "../lib/rate-limit";
import { sameSiteWrites } from "../lib/session";
import * as team from "../repositories/team";

/**
 * Accepting an invitation, from the link in the email.
 *
 * Mounted at /api/public/invitations because the person opening it has no
 * session — that is the point of it. The token is the only credential, so:
 *
 * - it travels in the body, never the path, so no request log or access log
 *   on the way here records it (the link itself carries it in the fragment,
 *   which the browser never sends at all);
 * - both routes are posts, with the same Origin check as the admin's writes
 *   (the accept page is served from the admin);
 * - a flood is cut off by a guard of their own (see `lib/rate-limit.ts`),
 *   and a made-up token never reaches the slow password hash;
 * - nothing is cached anywhere, since the answer changes the moment the link
 *   is used.
 *
 *   POST /api/public/invitations/lookup   { token }           → { name, email }, or 410
 *   POST /api/public/invitations/accept   { token, password } → 204, or 410 / 422
 */

export const invitationRoutes = new Hono()
  .use(invitationRateLimit)
  .use(sameSiteWrites)
  .use(invitationBodyLimit)
  .use(async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  })

  .post("/lookup", async (c) => {
    const { token } = invitationLookupSchema.parse(await c.req.json());
    return c.json(await team.previewInvitation(token));
  })

  .post("/accept", async (c) => {
    const { token, password } = acceptInvitationSchema.parse(await c.req.json());
    await team.acceptInvitation(token, password);
    return c.body(null, 204);
  });
