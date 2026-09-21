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
