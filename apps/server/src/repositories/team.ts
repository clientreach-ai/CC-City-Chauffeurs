import { createHash, randomBytes, randomUUID } from "node:crypto";

import { auth, CREDENTIAL } from "@CC-City-Chauffeurs/auth";
import {
  assertValid,
  CmsNotFoundError,
  CmsValidationError,
  INVITATION_DAYS,
  normaliseEmail,
  passwordProblem,
  validateInvite,
  type InvitationIssued,
  type InvitationPreview,
  type InviteMemberInput,
  type MemberStatus,
  type Role,
  type TeamMember,
  type UpdateMemberInput,
} from "@CC-City-Chauffeurs/core";
import { db, schema } from "@CC-City-Chauffeurs/db";
import { env } from "@CC-City-Chauffeurs/env/server";
import { and, asc, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { iso, isoOrNull } from "../lib/ids";
import { teamInvitation } from "../lib/notifications";

/**
 * The team: everyone who can sign in to the admin, and the invitations that
 * bring someone new in.
 *
 * Sign-up stays closed. An admin invites a person by name, email and role,
 * which makes an `invited` account with no password and a single-use link.
 * Opening the link lets them choose their own password — the account turns
 * `active` in the same transaction — so nobody, the admin included, ever
 * knows it. The link is the credential, so only its SHA-256 is stored: a copy
 * of the database cannot be used to accept an invitation.
 *
 * Two rules hold whatever order requests arrive in.
 *
 * - **There is always an active admin.** The last one cannot be demoted or
 *   deactivated, by themselves or anyone else. The check runs with every
 *   admin's row locked, so two admins demoting each other at the same moment
 *   are checked one after the other rather than both passing.
 * - **A link works once.** Accepting claims the invitation with a single
 *   conditional update; of two accepts at the same moment, the second finds
 *   it used.
 *
 * People are deactivated, not deleted, once they have used the admin: their
 * row stays so the name on the notes and activity they wrote still means
 * someone. Only an invitation nobody accepted is removed outright.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

/** Who is making the change, as the session describes them. */
export type Actor = { id: string; name: string; email: string };

const INVITATION_MS = INVITATION_DAYS * 24 * 60 * 60 * 1000;

const EMAIL_TAKEN = "Someone with this email address is already on the team.";
const INVALID_LINK = "This invitation link is invalid or has expired. Ask an admin to send a new one.";

/** 410: the link existed once, perhaps, but it does not now. Said the same way for every reason. */
const invalidInvitation = () => new HTTPException(410, { message: INVALID_LINK });

// ------------------------------------------------------------------ mapping

type UserRow = typeof schema.user.$inferSelect;

function toMember(row: UserRow, invitationExpiresAt: Date | null): TeamMember {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: iso(row.createdAt),
    lastActiveAt: isoOrNull(row.lastActiveAt),
    invitationExpiresAt: row.status === "invited" ? isoOrNull(invitationExpiresAt) : null,
  };
}

/** Active first, then those still to accept, then the switched off; by name within each. */
const statusOrder = sql`case ${schema.user.status} when 'active' then 0 when 'invited' then 1 else 2 end`;

/**
 * Everyone, with the expiry of their live invitation where they have one.
 * An expired invitation is still returned, so the Team page can say it has
 * expired rather than simply going quiet about it.
 */
async function members(executor: Db, id?: string): Promise<TeamMember[]> {
  const rows = await executor
    .select({ user: schema.user, expiresAt: schema.teamInvitation.expiresAt })
    .from(schema.user)
    .leftJoin(
      schema.teamInvitation,
      and(eq(schema.teamInvitation.userId, schema.user.id), isNull(schema.teamInvitation.usedAt)),
    )
    .where(id ? eq(schema.user.id, id) : undefined)
    .orderBy(statusOrder, sql`lower(${schema.user.name})`, asc(schema.user.id));
  return rows.map((row) => toMember(row.user, row.expiresAt));
}

async function member(executor: Db, id: string): Promise<TeamMember> {
  const [found] = await members(executor, id);
  if (!found) throw new CmsNotFoundError("This team member");
  return found;
}

export function listMembers(): Promise<TeamMember[]> {
  return members(db);
}

// ------------------------------------------------------------------ invitations

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * The stored form of a token from a link. A token is 43 characters; anything
 * far from that is not one, and gets the same 410 as every other link that
 * does not work rather than a lookup.
 */
function hashOf(token: string) {
  if (token.length < 20 || token.length > 100) throw invalidInvitation();
  return sha256(token);
}

/**
 * Where the link lands: the admin's own accept page. The token rides in the
 * fragment, which a browser never sends anywhere — so it is in no request
 * line, no access log and no Referer, on the admin's host or in front of the
 * API. The page reads it and posts it in a body.
 */
const invitationLink = (token: string) =>
  `${env.ADMIN_URL.replace(/\/+$/, "")}/accept-invite#token=${encodeURIComponent(token)}`;

/**
 * A fresh link for this member, replacing any earlier one — which stops
 * working the moment this commits. Returns the token itself, which exists
 * nowhere else: it goes into the email and back to the admin once, and only
 * its hash is kept.
 */
async function issueToken(tx: Tx, userId: string, invitedBy: string): Promise<string> {
  // 256 bits: not guessable, and short enough to sit in a URL without wrapping badly.
  const token = randomBytes(32).toString("base64url");
  await tx.delete(schema.teamInvitation).where(eq(schema.teamInvitation.userId, userId));
  await tx.insert(schema.teamInvitation).values({
    id: randomUUID(),
    userId,
    tokenHash: sha256(token),
    invitedBy,
    expiresAt: new Date(Date.now() + INVITATION_MS),
  });
  return token;
}

/**
 * Sends the email once the invitation is safely written, and hands the admin
 * the link either way. A mail server failing costs nothing but the
 * convenience: the admin is told, and passes the link on themselves.
 */
async function deliver(issued: TeamMember, token: string, inviter: Actor): Promise<InvitationIssued> {
  const link = invitationLink(token);
  const emailed = await teamInvitation({
    memberId: issued.id,
    name: issued.name,
    email: issued.email,
    role: issued.role,
    invitedBy: inviter.name || inviter.email,
    link,
  });
  return { member: issued, link, emailed };
}

/** Postgres refusing a duplicate key, however the driver wraps it. */
function isDuplicateKey(error: unknown) {
  for (let current = error; current; current = (current as { cause?: unknown }).cause) {
    if ((current as { code?: string }).code === "23505") return true;
  }
  return false;
}

/** Invites someone new. They appear on the team as `invited` until they choose a password. */
export async function inviteMember(input: InviteMemberInput, inviter: Actor): Promise<InvitationIssued> {
  const name = input.name.trim();
  const email = normaliseEmail(input.email);
  assertValid(validateInvite({ name, email, role: input.role }));

  const [taken] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(sql`lower(${schema.user.email})`, email))
    .limit(1);
  if (taken) throw new CmsValidationError({ email: EMAIL_TAKEN });

  const id = randomUUID();
  const { issued, token } = await db
    .transaction(async (tx) => {
      const now = new Date();
      await tx.insert(schema.user).values({
        id,
        name,
        email,
        role: input.role,
        status: "invited",
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      });
      const token = await issueToken(tx, id, inviter.id);
      return { issued: await member(tx, id), token };
    })
    .catch((error: unknown) => {
      // The same address added between the check above and this insert.
      if (isDuplicateKey(error)) throw new CmsValidationError({ email: EMAIL_TAKEN });
      throw error;
    });

  return deliver(issued, token, inviter);
}

/** A new link for someone who has not accepted yet. The old one stops working. */
export async function resendInvitation(id: string, inviter: Actor): Promise<InvitationIssued> {
  const { issued, token } = await db.transaction(async (tx) => {
    const row = await lockMember(tx, id);
    if (row.status !== "invited") {
      throw new CmsValidationError(
        {},
        row.status === "active"
          ? "They have already accepted their invitation and can sign in."
          : "Reactivate them first; an invitation is sent from there if they still need one.",
      );
    }
    const token = await issueToken(tx, id, inviter.id);
    return { issued: await member(tx, id), token };
  });
  return deliver(issued, token, inviter);
}

/**
 * Who an invitation link is for, so the accept page can greet them. Every
 * reason a link does not work — unknown, used, expired, replaced, the member
 * deactivated — gets the same 410, so the page cannot be used to learn which.
 */
export async function previewInvitation(token: string): Promise<InvitationPreview> {
  const [row] = await db
    .select({ name: schema.user.name, email: schema.user.email })
    .from(schema.teamInvitation)
    .innerJoin(schema.user, eq(schema.user.id, schema.teamInvitation.userId))
    .where(
      and(
        eq(schema.teamInvitation.tokenHash, hashOf(token)),
        isNull(schema.teamInvitation.usedAt),
        gt(schema.teamInvitation.expiresAt, new Date()),
        eq(schema.user.status, "invited"),
      ),
    )
    .limit(1);
  if (!row) throw invalidInvitation();
  return row;
}

/**
 * The invited person chooses their password. Afterwards they sign in like
 * anyone else, and the link is spent.
 */
export async function acceptInvitation(token: string, password: string): Promise<void> {
  const problem = passwordProblem(password);
  if (problem) throw new CmsValidationError({ password: problem });

  const tokenHash = hashOf(token);
  // The cheap check first. scrypt is deliberately slow, so it runs only for a
  // link that is live right now: a made-up token costs a lookup, never a
  // hash. The transaction below checks again, under lock, for real.
  await previewInvitation(token);

  // Hashed before the transaction, so no row lock is held while it runs.
  // better-auth owns the format — a hash made any other way fails to verify
  // at sign-in with nothing to say why.
  const hash = await (await auth.$context).password.hash(password);

  await db.transaction(async (tx) => {
    const [found] = await tx
      .select({ userId: schema.teamInvitation.userId })
      .from(schema.teamInvitation)
      .where(eq(schema.teamInvitation.tokenHash, tokenHash))
      .limit(1);
    if (!found) throw invalidInvitation();

    // The member's row is locked before the invitation is touched — the same
    // order the Team page's own changes take — so the two cannot deadlock,
    // and a deactivation cannot land between this check and the update.
    const [owner] = await tx
      .select({ status: schema.user.status })
      .from(schema.user)
      .where(eq(schema.user.id, found.userId))
      .for("update");
    if (owner?.status !== "invited") throw invalidInvitation();

    // Claimed only while unused and in date, in one statement: of two accepts
    // at the same moment, the second finds it used and is refused.
    const now = new Date();
    const [claimed] = await tx
      .update(schema.teamInvitation)
      .set({ usedAt: now })
      .where(
        and(
          eq(schema.teamInvitation.tokenHash, tokenHash),
          isNull(schema.teamInvitation.usedAt),
          gt(schema.teamInvitation.expiresAt, now),
        ),
      )
      .returning({ id: schema.teamInvitation.id });
    if (!claimed) throw invalidInvitation();

    await setPassword(tx, found.userId, hash, now);
    await tx
      .update(schema.user)
      .set({ status: "active", emailVerified: true, updatedAt: now })
      .where(eq(schema.user.id, found.userId));
    // Anything else issued to them is now meaningless; the spent row is kept as the record.
    await tx
      .delete(schema.teamInvitation)
      .where(and(eq(schema.teamInvitation.userId, found.userId), ne(schema.teamInvitation.id, claimed.id)));
  });
}

/** Creates or replaces the member's email-and-password login. */
async function setPassword(tx: Tx, userId: string, hash: string, now: Date) {
  const [existing] = await tx
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, CREDENTIAL.providerId)))
    .limit(1);
  if (existing) {
    await tx.update(schema.account).set({ password: hash, updatedAt: now }).where(eq(schema.account.id, existing.id));
    return;
  }
  await tx.insert(schema.account).values({
    id: randomUUID(),
    // better-auth finds a password login by the user's own id, qualified by issuer.
    accountId: userId,
    providerId: CREDENTIAL.providerId,
    issuer: CREDENTIAL.issuer,
    userId,
    password: hash,
    createdAt: now,
    updatedAt: now,
  });
}

// ------------------------------------------------------------------ changes

/** The member's row, locked for the rest of the transaction, or a 404. */
async function lockMember(tx: Tx, id: string): Promise<UserRow> {
  const [row] = await tx.select().from(schema.user).where(eq(schema.user.id, id)).for("update");
  if (!row) throw new CmsNotFoundError("This team member");
  return row;
}

async function hasPassword(tx: Tx, userId: string) {
  const [row] = await tx
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, CREDENTIAL.providerId)))
    .limit(1);
  return row != null;
}

/**
 * A new role, a deactivation or a reactivation.
 *
 * A role change takes effect on their next request: the role is read from
 * the database with the session every time, never trusted from the browser.
 * Deactivating signs them out everywhere and withdraws any invitation.
 * Reactivating someone who never chose a password makes them `invited`
 * again — the caller then sends them a new link — since there is nothing
 * they could sign in with.
 */
export async function updateMember(id: string, input: UpdateMemberInput, actor: Actor): Promise<TeamMember> {
  return db.transaction(async (tx) => {
    // Every admin and this member, locked in a fixed order before anything is
    // read, so two admins demoting or deactivating each other at the same
    // moment are checked one after the other.
    await tx
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(or(eq(schema.user.role, "admin"), eq(schema.user.id, id)))
      .orderBy(asc(schema.user.id))
      .for("update");
    const row = await lockMember(tx, id);

    if (input.status === "deactivated" && id === actor.id) {
      throw new CmsValidationError(
        { status: "You cannot deactivate your own account." },
        "You cannot deactivate your own account.",
      );
    }

    const role: Role = input.role ?? row.role;
    let status: MemberStatus = row.status;
    if (input.status === "deactivated") status = "deactivated";
    if (input.status === "active" && row.status !== "active") {
      status = (await hasPassword(tx, id)) ? "active" : "invited";
    }

    // Losing an active admin is only allowed while another one remains.
    const wasActiveAdmin = row.role === "admin" && row.status === "active";
    const staysActiveAdmin = role === "admin" && status === "active";
    if (wasActiveAdmin && !staysActiveAdmin) {
      const [others] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.user)
        .where(and(eq(schema.user.role, "admin"), eq(schema.user.status, "active"), ne(schema.user.id, id)));
      if (!others?.count) {
        const message = "There must always be at least one active admin. Make someone else an admin first.";
        throw new CmsValidationError({ [input.status === "deactivated" ? "status" : "role"]: message }, message);
      }
    }

    if (role !== row.role || status !== row.status) {
      await tx.update(schema.user).set({ role, status, updatedAt: new Date() }).where(eq(schema.user.id, id));
    }

    if (status === "deactivated" && row.status !== "deactivated") {
      // Signed out everywhere at once, and any link they were sent stops working.
      await tx.delete(schema.session).where(eq(schema.session.userId, id));
      await tx.delete(schema.teamInvitation).where(eq(schema.teamInvitation.userId, id));
    }

    return member(tx, id);
  });
}

/**
 * Withdraws an invitation nobody accepted, removing the person altogether.
 *
 * Only while they are `invited`: until then they have done nothing in the
 * admin, so nothing refers to them. Anyone who has signed in is deactivated
 * instead, and keeps their place on the history they are part of.
 */
export async function deleteMember(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await lockMember(tx, id);
    if (row.status !== "invited") {
      throw new CmsValidationError(
        {},
        "Deactivate them instead — their name stays on the history they are part of.",
      );
    }
    // Their invitation, and anything else hanging off the row, goes with it.
    await tx.delete(schema.user).where(eq(schema.user.id, id));
  });
}
