import { createDb } from "@CC-City-Chauffeurs/db";
import * as schema from "@CC-City-Chauffeurs/db/schema/auth";
import { env } from "@CC-City-Chauffeurs/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

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
       * A new account is made by hand against the database, which is how the
       * current one exists — insert the `user` row with its `role`, and the
       * matching `account` row carrying better-auth's password hash. There is
       * no other way in now, and that is deliberate: this admin has one
       * client and a handful of staff, not a sign-up funnel.
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
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      /**
       * `none` is what a cross-origin admin needs, and it is why signing in
       * never worked on an iPhone: a cookie from another origin is a
       * third-party cookie, and Safari has refused those by default since
       * 2020 — so the session was dropped the moment it was issued.
       *
       * The admin now reaches the API through its own origin (see its
       * `next.config.ts`), which makes this cookie first-party, and `none` is
       * accepted first-party — so nothing here had to change alongside it.
       *
       * Once that is live, this should become `lax`, and `secure`/`httpOnly`
       * can go: better-auth derives both, and deriving `secure` rather than
       * forcing it is what lets Safari keep the cookie on http://localhost in
       * development. Do it in a later deploy, not the same one — the API
       * ships on every push to master while the admin ships separately, so
       * `lax` arriving first would lock out everyone rather than just iPhones.
       */
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [],
  });
}

export const auth = createAuth();
