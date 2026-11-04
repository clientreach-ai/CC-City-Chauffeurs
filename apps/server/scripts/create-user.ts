/**
 * Makes an admin account.
 *
 * Sign-up is closed on the API, so there is no way in through the front door
 * and no screen that offers this — deliberately, because the endpoint that
 * used to do it was open to anyone who found it. An account is a thing
 * somebody with database access creates on purpose, which is this.
 *
 * The password is hashed by better-auth itself rather than by anything
 * written here: it owns the format, and a hash produced any other way simply
 * fails to verify at sign-in with nothing to say why.
 *
 *   bun run scripts/create-user.ts <email> <password> <name> [role]
 *
 * Role defaults to `admin`. Re-running for an existing email changes that
 * account's password and role rather than making a second one — and makes it
 * `active`, so this is also the way back in for an admin who has been
 * deactivated, or who never accepted their invitation.
 *
 * This is for the first admin, and for getting back in when nobody can. Everyone
 * else is invited from the admin's Team page and chooses their own password.
 */

import { auth, CREDENTIAL } from "@CC-City-Chauffeurs/auth";
import { db, schema } from "@CC-City-Chauffeurs/db";
import { canSignInWith, normaliseEmail, passwordProblem, roles, type Role } from "@CC-City-Chauffeurs/core";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const [email, password, name, role = "admin"] = process.argv.slice(2);

if (!email || !password || !name) {
  console.error("Usage: bun run scripts/create-user.ts <email> <password> <name> [role]");
  process.exit(1);
}

if (!roles.some((known) => known.value === role)) {
  console.error(`Role must be one of: ${roles.map((known) => known.value).join(", ")}`);
  process.exit(1);
}

// The same rules an invitation is held to, so this way in makes nothing the
// rest of the system would treat differently.
const problem = passwordProblem(password);
if (problem) {
  console.error(problem);
  process.exit(1);
}

if (!canSignInWith(email)) {
  console.error("That address can't be used to sign in. Use a plain one, like name@company.co.uk.");
  process.exit(1);
}

const address = normaliseEmail(email);
const context = await auth.$context;
const hash = await context.password.hash(password);
const now = new Date();

const [existing] = await db
  .select()
  .from(schema.user)
  .where(eq(schema.user.email, address))
  .limit(1);

if (existing) {
  await db
    .update(schema.user)
    .set({ name, role: role as Role, status: "active", emailVerified: true, updatedAt: now })
    .where(eq(schema.user.id, existing.id));

  // An invitation they had not accepted would otherwise still set a password.
  await db.delete(schema.teamInvitation).where(eq(schema.teamInvitation.userId, existing.id));

  const [account] = await db
    .select()
    .from(schema.account)
    .where(eq(schema.account.userId, existing.id))
    .limit(1);

  if (account) {
    await db
      .update(schema.account)
      .set({ password: hash, updatedAt: now })
      .where(eq(schema.account.id, account.id));
  } else {
    await db.insert(schema.account).values({
      id: randomUUID(),
      accountId: existing.id,
      providerId: CREDENTIAL.providerId,
      issuer: CREDENTIAL.issuer,
      userId: existing.id,
      password: hash,
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log(`Updated ${address} — role ${role}, active.`);
  process.exit(0);
}

const id = randomUUID();

await db.insert(schema.user).values({
  id,
  email: address,
  name,
  role: role as Role,
  status: "active",
  emailVerified: true,
  createdAt: now,
  updatedAt: now,
});

/** The row better-auth looks a password sign-in up by — see `CREDENTIAL`. */
await db.insert(schema.account).values({
  id: randomUUID(),
  accountId: id,
  providerId: CREDENTIAL.providerId,
  issuer: CREDENTIAL.issuer,
  userId: id,
  password: hash,
  createdAt: now,
  updatedAt: now,
});

console.log(`Created ${address} — role ${role}.`);
process.exit(0);
