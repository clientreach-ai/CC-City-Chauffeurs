import type { InviteMemberInput, UpdateMemberInput } from "@CC-City-Chauffeurs/core";
import { inviteMemberSchema, updateMemberSchema } from "@CC-City-Chauffeurs/core/schemas";
import { Hono } from "hono";

import { requires, type SessionUser, type Variables } from "../lib/session";
import * as team from "../repositories/team";

/**
 * The team, for the admin.
 *
 * Anyone signed in may see who else is on it — the names on notes and
 * activity mean more when you can see who they belong to. Everything that
 * changes it needs `team.manage`, which only an admin has. The rules (one
 * active admin always, nobody deactivates themselves, only an unaccepted
 * invitation is ever deleted) live in the repository, so they hold however
 * the request was made.
 *
 * None of these paths is in `lib/revalidate.ts`, so a change to the team
 * never purges the website's cache: nothing here is on the website.
 */

/** Set by `requires()`, which has already refused a request without one. */
const actor = (user: SessionUser | null) => user!;

export const teamRoutes = new Hono<{ Variables: Variables }>()
  .get("/team", async (c) => c.json(await team.listMembers()))

  /** Invites someone. 201 with the member, the link (shown once) and whether it was emailed. */
  .post("/team", requires("team.manage"), async (c) => {
    const input = inviteMemberSchema.parse(await c.req.json()) as InviteMemberInput;
    return c.json(await team.inviteMember(input, actor(c.get("user"))), 201);
  })

  .patch("/team/:id", requires("team.manage"), async (c) => {
    const input = updateMemberSchema.parse(await c.req.json()) as UpdateMemberInput;
    return c.json(await team.updateMember(c.req.param("id"), input, actor(c.get("user"))));
  })

  /** A new link for someone still `invited`; the previous one stops working. */
  .post("/team/:id/invitation", requires("team.manage"), async (c) =>
    c.json(await team.resendInvitation(c.req.param("id"), actor(c.get("user")))),
  )

  /** Withdraws an unaccepted invitation. Anyone who has signed in is deactivated instead. */
  .delete("/team/:id", requires("team.manage"), async (c) => {
    await team.deleteMember(c.req.param("id"));
    return c.body(null, 204);
  });
