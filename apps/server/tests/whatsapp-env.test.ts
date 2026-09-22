/**
 * The settings that decide whether the channel may start at all.
 *
 * These are the rules the server is held to at boot. They matter most in the
 * cases nobody means to create: a scripted assistant left switched on in
 * production would answer every customer the same sentence, and the
 * simulator webhook would take a message from anybody who found it.
 */

import { describe, expect, test } from "bun:test";
import { whatsappConfigProblems, type WhatsAppSettings } from "@CC-City-Chauffeurs/env/whatsapp";

const twilio: WhatsAppSettings = {
  WHATSAPP_PROVIDER: "twilio",
  WHATSAPP_NUMBER: "+442084433332",
  WHATSAPP_WEBHOOK_URL: "https://citychauffeursapi.clientreach.ai/api/whatsapp/twilio",
  TWILIO_ACCOUNT_SID: "AC00000000000000000000000000000000",
  TWILIO_AUTH_TOKEN: "token",
  WHATSAPP_AI_PROVIDER: "openai",
  OPENAI_API_KEY: "sk-test",
};

const paths = (settings: WhatsAppSettings) => whatsappConfigProblems(settings).map((problem) => problem.path);

describe("switched off", () => {
  test("nothing else matters", () => {
    expect(whatsappConfigProblems({})).toEqual([]);
    expect(whatsappConfigProblems({ WHATSAPP_PROVIDER: "disabled", NODE_ENV: "production" })).toEqual([]);
  });
});

describe("in production", () => {
  const production = { ...twilio, NODE_ENV: "production" };

  test("a full Twilio configuration is accepted", () => {
    expect(whatsappConfigProblems(production)).toEqual([]);
  });

  test("a scripted assistant is refused", () => {
    const problems = whatsappConfigProblems({ ...production, WHATSAPP_AI_PROVIDER: "scripted" });

    expect(paths({ ...production, WHATSAPP_AI_PROVIDER: "scripted" })).toEqual(["WHATSAPP_AI_PROVIDER"]);
    expect(problems[0]!.message).toContain("answers from a fixed script");
  });

  test("the simulator is refused, signed or not", () => {
    const simulator: WhatsAppSettings = { ...production, WHATSAPP_PROVIDER: "simulator" };

    expect(paths(simulator)).toEqual(["WHATSAPP_PROVIDER"]);
    expect(paths({ ...simulator, WHATSAPP_SIMULATOR_SECRET: "a-secret-long-enough" })).toEqual(["WHATSAPP_PROVIDER"]);
  });

  test("a missing OpenAI key stops the server rather than the first customer", () => {
    expect(paths({ ...production, OPENAI_API_KEY: undefined })).toEqual(["OPENAI_API_KEY"]);
  });
});

describe("away from production", () => {
  test("the scripted assistant is how the channel runs without a key", () => {
    expect(whatsappConfigProblems({ ...twilio, WHATSAPP_AI_PROVIDER: "scripted", OPENAI_API_KEY: undefined })).toEqual([]);
  });

  test("the simulator still has to be signed", () => {
    const simulator: WhatsAppSettings = { ...twilio, WHATSAPP_PROVIDER: "simulator" };

    expect(paths(simulator)).toEqual(["WHATSAPP_SIMULATOR_SECRET"]);
    expect(whatsappConfigProblems({ ...simulator, WHATSAPP_SIMULATOR_SECRET: "a-secret-long-enough" })).toEqual([]);
  });
});

describe("Twilio", () => {
  test("cannot start without the address it signs, or the account it signs with", () => {
    expect(paths({ ...twilio, WHATSAPP_WEBHOOK_URL: undefined })).toEqual(["WHATSAPP_WEBHOOK_URL"]);
    expect(paths({ ...twilio, TWILIO_ACCOUNT_SID: undefined, TWILIO_AUTH_TOKEN: undefined })).toEqual([
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
    ]);
  });

  test("cannot start without knowing which number is ours", () => {
    expect(paths({ ...twilio, WHATSAPP_NUMBER: undefined })).toEqual(["WHATSAPP_NUMBER"]);
  });

  test("every missing setting is named at once, not one per restart", () => {
    expect(paths({ WHATSAPP_PROVIDER: "twilio" })).toEqual([
      "WHATSAPP_NUMBER",
      "WHATSAPP_WEBHOOK_URL",
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "OPENAI_API_KEY",
    ]);
  });
});
