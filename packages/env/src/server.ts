import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * A comma-separated list of origins: the website and the admin run on
 * different ports in development and different subdomains in production, and
 * both need to reach the API with credentials.
 */
const originList = z
  .string()
  .min(1)
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  )
  .refine((origins) => origins.length > 0 && origins.every((origin) => URL.canParse(origin)), {
    message: "Each origin must be a full URL, e.g. https://admin.example.com",
  });

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    /** Origins allowed to call the API. */
    CORS_ORIGIN: originList,
    /** Where the website serves its own photography from. */
    SITE_URL: z.url().default("http://localhost:3001"),
    /** This API's own public address. */
    API_URL: z.url().default("http://localhost:3000"),
    /**
     * Cloudflare R2, where every photograph lives.
     *
     * The bucket is reached through its S3 endpoint with the account id in
     * the host, and read back by the public through `R2_PUBLIC_BASE_URL` —
     * either the bucket's r2.dev address or a custom domain in front of it.
     * The bucket may be shared with other projects, so everything this site
     * stores sits under `R2_PREFIX`; nothing outside it is ever listed,
     * written or deleted.
     */
    R2_ACCOUNT_ID: z.string().min(1),
    R2_PUBLIC_ACCESS_KEY_ID: z.string().min(1),
    R2_PUBLIC_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET: z.string().min(1),
    R2_PUBLIC_BASE_URL: z.url().transform((value) => value.replace(/\/+$/, "")),
    R2_PREFIX: z
      .string()
      .default("city-chauffeurs")
      .transform((value) => value.replace(/^\/+|\/+$/g, ""))
      .refine((value) => value.length > 0, { message: "R2_PREFIX cannot be empty." }),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
