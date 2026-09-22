import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { DEFAULT_WHATSAPP_MODEL, whatsappConfigProblems } from "./whatsapp";

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

    /**
     * WhatsApp, answered by the assistant.
     *
     * Every one of these is optional, and the default is `disabled`: a
     * deployment that sets none of them boots exactly as it did before, with
     * no webhook mounted. `twilio` is the real thing; `simulator` is the same
     * pipeline with a JSON wire format of its own, for a developer's machine
     * and the tests.
     */
    WHATSAPP_PROVIDER: z.enum(["disabled", "twilio", "simulator"]).default("disabled"),
    /**
     * The exact public address Twilio posts to, path included — e.g.
     * https://citychauffeursapi.clientreach.ai/api/whatsapp/twilio. Twilio
     * signs the address it was given, and behind a proxy that is not the one
     * the server hears, so it is configured rather than worked out.
     */
    WHATSAPP_WEBHOOK_URL: z.url().optional(),
    /** Our WhatsApp number in E.164, e.g. +442084433332. Messages to any other number are ignored. */
    WHATSAPP_NUMBER: z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/, "WHATSAPP_NUMBER must be in E.164, e.g. +442084433332.")
      .optional(),
    TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
    TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
    /**
     * Signs what is posted to the simulator webhook. Required in production
     * if the simulator is on at all.
     */
    WHATSAPP_SIMULATOR_SECRET: z.string().min(16).optional(),
    /**
     * `scripted` answers from a fixed script with no model behind it — for
     * local runs without a key, and refused in production.
     */
    WHATSAPP_AI_PROVIDER: z.enum(["openai", "scripted"]).default("openai"),
    /**
     * Any OpenAI model the Responses API serves. The default is a capable
     * model at a price that suits short conversations; it must be one that
     * takes the `reasoning` parameter unless WHATSAPP_AI_EFFORT is `none`.
     */
    WHATSAPP_AI_MODEL: z.string().min(1).default(DEFAULT_WHATSAPP_MODEL),
    /**
     * How much the model may think before answering. `low` suits a short
     * WhatsApp reply; `none` sends no reasoning setting at all, for a model
     * that has none.
     */
    WHATSAPP_AI_EFFORT: z.enum(["none", "low", "medium", "high"]).default("low"),
    OPENAI_API_KEY: z.string().min(1).optional(),
  },
  /**
   * The WhatsApp settings are checked together, by the rules in
   * `./whatsapp.ts`, so a half-configured channel never reaches a customer.
   */
  createFinalSchema: (shape) =>
    z.object(shape).superRefine((value, context) => {
      for (const problem of whatsappConfigProblems(value)) {
        context.addIssue({ code: "custom", path: [problem.path], message: problem.message });
      }
    }),
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
