/**
 * The WhatsApp webhook as the API mounts it.
 *
 * Not the conversation itself — the channel's own tests cover what the
 * assistant says. This is the server's half: that the webhook is where the
 * provider will post, that it reads the body as it arrived and caps it before
 * reading, that it answers before the assistant runs and the run still
 * happens afterwards. Run with the simulator and the scripted model, so
 * nothing leaves the process.
 *
 * The channel is built here rather than from the environment: every test file
 * shares one module registry, so the server's own environment was read — with
 * WhatsApp switched off — by whichever file imported it first.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createWhatsAppChannel,
  ScriptedModel,
  SimulatorProvider,
  simulatorSignature,
  type E164,
} from "@CC-City-Chauffeurs/whatsapp";
import { Hono } from "hono";

import { setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();
const SECRET = "a-simulator-secret-for-the-tests";
const OURS = "+442084433332" as E164;

let database: TestDatabase;
let app: Hono;

beforeAll(async () => {
  database = await startDatabase();
  const { createWhatsAppStore } = await import("../src/repositories/whatsapp");
  const { createWhatsAppBackend } = await import("../src/lib/whatsapp-backend");
  const { whatsappWebhookRoutes } = await import("../src/routes/whatsapp");

  const provider = new SimulatorProvider({ secret: SECRET, ourNumber: OURS });
  const channel = createWhatsAppChannel({
    provider,
    store: createWhatsAppStore({ provider: provider.name }),
    backend: createWhatsAppBackend(),
    model: new ScriptedModel(),
    config: { webhookUrl: "http://localhost/api/whatsapp/simulator", ourNumber: OURS },
    log: { info() {}, warn() {}, error() {} },
  });
  app = new Hono().route("/api/whatsapp", whatsappWebhookRoutes("simulator", async () => channel));
}, 60_000);

afterAll(async () => {
  await database.stop();
});

let caller = 0;
function post(path: string, body: string, headers: Record<string, string> = {}) {
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `198.51.100.${(caller += 1) % 250}`,
        ...headers,
      },
      body,
    }),
  );
}

const signed = (body: string) => ({ "x-simulator-signature": simulatorSignature(body, SECRET) });

async function rows(sql: string) {
  return (await database.client.query(sql)).rows as Record<string, unknown>[];
}

async function eventually<T>(read: () => Promise<T>, done: (value: T) => boolean, ms = 5_000) {
  const until = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (done(value) || Date.now() > until) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe("the WhatsApp webhook", () => {
  test("records the message, answers at once, and runs the assistant afterwards", async () => {
    const body = JSON.stringify({
      messages: [{ id: "sim-1", from: "+447700900321", to: "+442084433332", name: "Amelia", type: "text", text: "Hello" }],
    });

    const response = await post("/api/whatsapp/simulator", body, signed(body));
    expect(response.status).toBe(200);
    expect((await rows("select direction from whatsapp_message")).map((row) => row.direction)).toContain("inbound");

    const runs = await eventually(
      () => rows("select status from whatsapp_agent_run"),
      (found) => found.every((run) => run.status !== "queued" && run.status !== "running"),
    );
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status).toBe("succeeded");
    const replies = await rows("select author, delivery from whatsapp_message where direction = 'outbound'");
    expect(replies).toEqual([{ author: "assistant", delivery: "sent" }]);
  });

  test("refuses a request that is not signed", async () => {
    const body = JSON.stringify({ messages: [] });
    expect((await post("/api/whatsapp/simulator", body)).status).toBe(401);
  });

  test("refuses an oversized body before reading it", async () => {
    const body = "x".repeat(70 * 1024);
    const response = await post("/api/whatsapp/simulator", body, signed(body));
    expect(response.status).toBe(413);
    // The route's own cap, not the channel's: the body was never handed over.
    expect(await response.text()).toBe("Payload too large.");
  });

  test("mounts only the configured provider's webhook", async () => {
    const response = await post("/api/whatsapp/twilio", "Body=Hello", {
      "Content-Type": "application/x-www-form-urlencoded",
    });
    expect(response.status).toBe(404);
  });
});
