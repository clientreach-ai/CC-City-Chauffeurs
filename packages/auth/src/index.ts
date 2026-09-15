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
