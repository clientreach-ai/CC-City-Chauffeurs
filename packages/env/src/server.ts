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
    /** `scripted` answers from a fixed script with no model behind it — for local runs without an API key. */
    WHATSAPP_AI_PROVIDER: z.enum(["anthropic", "scripted"]).default("anthropic"),
    WHATSAPP_AI_MODEL: z.string().min(1).default("claude-opus-5"),
    WHATSAPP_AI_EFFORT: z.enum(["low", "medium", "high"]).default("medium"),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
  },
  /**
   * The WhatsApp settings depend on one another, and a half-configured
   * channel should stop the server at boot with a sentence saying what is
   * missing — not start, take a customer's message, and fail on the reply.
   */
  createFinalSchema: (shape) =>
    z.object(shape).superRefine((value, context) => {
      const missing = (name: string, why: string) =>
        context.addIssue({ code: "custom", path: [name], message: `${name} is required ${why}.` });

      if (value.WHATSAPP_PROVIDER === "disabled") return;
      const why = `when WHATSAPP_PROVIDER is ${value.WHATSAPP_PROVIDER}`;
      if (!value.WHATSAPP_NUMBER) missing("WHATSAPP_NUMBER", why);
      if (value.WHATSAPP_PROVIDER === "twilio") {
        // Twilio signs the address it was given. The simulator signs only the
        // body, so it can do without and falls back to API_URL.
        if (!value.WHATSAPP_WEBHOOK_URL) missing("WHATSAPP_WEBHOOK_URL", why);
        if (!value.TWILIO_ACCOUNT_SID) missing("TWILIO_ACCOUNT_SID", why);
        if (!value.TWILIO_AUTH_TOKEN) missing("TWILIO_AUTH_TOKEN", why);
      }
      // Unsigned, the simulator takes a message from anybody who can reach
      // it — fine on a laptop, not on the internet.
      if (
        value.WHATSAPP_PROVIDER === "simulator" &&
        value.NODE_ENV === "production" &&
        !value.WHATSAPP_SIMULATOR_SECRET
      ) {
        missing("WHATSAPP_SIMULATOR_SECRET", "to run the simulator in production");
      }
      if (value.WHATSAPP_AI_PROVIDER === "anthropic" && !value.ANTHROPIC_API_KEY) {
        missing("ANTHROPIC_API_KEY", "when WHATSAPP_AI_PROVIDER is anthropic");
      }
    }),
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
