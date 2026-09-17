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
 * account's password and role rather than making a second one.
 */

import { auth } from "@CC-City-Chauffeurs/auth";
import { db, schema } from "@CC-City-Chauffeurs/db";
import { roles, type Role } from "@CC-City-Chauffeurs/core";
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

if (password.length < 12) {
  console.error("Use a longer password — at least 12 characters.");
  process.exit(1);
}

const address = email.trim().toLowerCase();
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
    .set({ name, role: role as Role, updatedAt: now })
    .where(eq(schema.user.id, existing.id));

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
      providerId: "credential",
      issuer: "credential",
      userId: existing.id,
      password: hash,
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log(`Updated ${address} — role ${role}.`);
  process.exit(0);
}

const id = randomUUID();

await db.insert(schema.user).values({
  id,
  email: address,
  name,
  role: role as Role,
  emailVerified: true,
  createdAt: now,
  updatedAt: now,
});

/**
 * better-auth looks an email/password sign-in up by `providerId: "credential"`
 * with `accountId` set to the user's own id. Anything else stores a row it
 * will never find.
 */
await db.insert(schema.account).values({
  id: randomUUID(),
  accountId: id,
  providerId: "credential",
  issuer: "credential",
  userId: id,
  password: hash,
  createdAt: now,
  updatedAt: now,
});

console.log(`Created ${address} — role ${role}.`);
process.exit(0);
