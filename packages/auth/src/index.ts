import { createDb } from "@CC-City-Chauffeurs/db";
import * as schema from "@CC-City-Chauffeurs/db/schema/auth";
import { env } from "@CC-City-Chauffeurs/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

/**
 * What better-auth writes on the account row behind an email and password.
 * It finds a password login by `providerId` with `accountId` set to the
 * user's own id, qualified by `issuer` — "local:credential", not
 * "credential". A row written with anything else is one it never finds: the
 * sign-in answers "Invalid email or password" for a password that is
 * correct. Anything here that writes a password row uses this.
 */
export const CREDENTIAL = { providerId: "credential", issuer: "local:credential" } as const;

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",

      schema: schema,
    }),
    trustedOrigins: env.CORS_ORIGIN,
    emailAndPassword: {
      enabled: true,
      /**
       * Nobody may register themselves.
       *
       * The API is reachable from the internet, and an open `/sign-up/email`
       * meant anyone who found it could make an account — which defaults to
       * `editor`, and an editor may edit the client's live content. Closing
       * it only refuses new registrations: existing accounts sign in exactly
       * as before, and sessions already issued are untouched.
       *
       * The first admin is made by `apps/server/scripts/create-user.ts`;
       * everyone after that is invited from the admin's Team page and chooses
       * their own password from a single-use link. There is no other way in,
       * and that is deliberate: this admin has one client and a handful of
       * staff, not a sign-up funnel.
       */
      disableSignUp: true,
    },
    user: {
      additionalFields: {
        /**
         * What this user may do in the admin. Carried on the session so a
         * request can be authorised without a second query, and enforced by
         * the API on every write.
         */
        role: {
          type: "string",
          required: false,
          defaultValue: "editor",
          input: false,
        },
        /**
         * Whether they may sign in at all: `invited`, `active` or
         * `deactivated`. Never accepted from a request — it changes only
         * through the Team routes and the invitation a member accepts.
         */
        status: {
          type: "string",
          required: false,
          defaultValue: "active",
          input: false,
        },
      },
    },
    databaseHooks: {
      session: {
        create: {
          /**
           * Only an active member may hold a session, however it was asked
           * for. An invited account has no password yet and a deactivated one
           * has been switched off, but either could still have a credential
           * row — this is the check that makes the right password not enough.
           * Returning `false` makes better-auth refuse the sign-in.
           *
           * Read fresh from the table rather than trusting whatever user
           * object better-auth has in hand, because that is exactly the
           * value a deactivation has just changed.
           *
           * This is the polite refusal, not the only one. A deactivation
           * committing between this read and the insert would slip past it,
           * so the database refuses the insert too (migration 0007), under
           * the same row lock the deactivation takes.
           */
          before: async (created) => {
            const member = await db.query.user.findFirst({
              where: (row, { eq }) => eq(row.id, created.userId),
              columns: { status: true },
            });
            if (member && member.status !== "active") return false;
          },
        },
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      /**
       * `lax`: the admin reaches the API through its own origin (see its
       * `next.config.ts`), so the session cookie is first-party and a
       * cross-site request never needs it. That makes this the browser's own
       * CSRF defence — a page on another site cannot make a signed-in
       * browser send the cookie with a write — and it sits behind the Origin
       * check the API applies to every admin write.
       *
       * It was `none` while the admin still called the API cross-origin,
       * which is also why signing in failed on an iPhone: Safari refuses
       * third-party cookies. That rewrite shipped in #12 and is live.
       */
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [],
  });
}

export const auth = createAuth();
