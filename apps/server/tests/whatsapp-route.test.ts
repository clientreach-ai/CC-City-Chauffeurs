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
import type { Role } from "@CC-City-Chauffeurs/core";
import { Hono } from "hono";

import type { Variables as SessionVariables } from "../src/lib/session";

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

/**
 * The office's half of the webhook: the same routes the admin calls, behind
 * the same session and capability middleware the API puts in front of every
 * admin route. The session itself is better-auth's and is not rebuilt here;
 * what is proved is that a caller without one gets nowhere, that a role
 * without `operations` gets nowhere either, and that a reply typed in the
 * office reaches the customer and the transcript.
 */
describe("the office's conversations", () => {
  let admin: Hono<{ Variables: SessionVariables }>;
  let as: { role: Role } | null;
  let sent: { to: string; body: string }[];

  beforeAll(async () => {
    const { whatsappAdminRoutes } = await import("../src/routes/whatsapp");
    const { requireUser } = await import("../src/lib/session");
    const { errorResponse } = await import("../src/lib/errors");
    const { createWhatsAppStore } = await import("../src/repositories/whatsapp");
    const { createWhatsAppBackend } = await import("../src/lib/whatsapp-backend");

    const provider = new SimulatorProvider({ ourNumber: OURS });
    sent = provider.sent as unknown as { to: string; body: string }[];
    const channel = createWhatsAppChannel({
      provider,
      store: createWhatsAppStore({ provider: provider.name }),
      backend: createWhatsAppBackend(),
      model: new ScriptedModel(),
      config: { webhookUrl: "http://localhost/api/whatsapp/simulator", ourNumber: OURS },
      log: { info() {}, warn() {}, error() {} },
    });

    admin = new Hono<{ Variables: SessionVariables }>()
      // Where the real API puts the session it read from the cookie.
      .use(async (c, next) => {
        c.set("user", as ? { id: "usr-1", name: "Faheem", email: "f@example.com", image: null, role: as.role } : null);
        await next();
      })
      .use(requireUser)
      .route("/api/admin", new Hono().route("/", whatsappAdminRoutes(async () => channel)));
    admin.onError((error, c) => errorResponse(error, c));
  });

  /** A conversation with a customer waiting for a person. */
  async function waiting() {
    const body = JSON.stringify({
      messages: [{ id: `SM${Date.now()}`, from: "+447700900321", to: OURS, name: "Amelia", type: "text", text: "Hello" }],
    });
    const { createWhatsAppStore } = await import("../src/repositories/whatsapp");
    const store = createWhatsAppStore({ provider: "simulator" });
    const recorded = await store.recordInbound(
      { provider: "simulator", providerMessageId: `SM${Date.now()}`, to: OURS, from: "+447700900321" as E164, profileName: "Amelia", kind: "text", text: "Is anyone there?", receivedAt: new Date() },
      null,
    );
    if (recorded.outcome !== "recorded") throw new Error("expected a conversation");
    await store.setStatus(recorded.conversation.id, "human_requested");
    void body;
    return recorded.conversation.id;
  }

  const call = (path: string, init: RequestInit = {}) =>
    admin.fetch(new Request(`http://localhost/api/admin${path}`, init));

  test("a caller with no session is refused", async () => {
    as = null;
    expect((await call("/whatsapp/conversations")).status).toBe(401);
  });

  test("a role without operations is refused", async () => {
    as = { role: "editor" };
    expect((await call("/whatsapp/conversations")).status).toBe(403);
  });

  test("the office can see who is waiting for a person", async () => {
    const conversationId = await waiting();
    as = { role: "manager" };

    const response = await call("/whatsapp/conversations?status=human_requested");
    expect(response.status).toBe(200);
    const listed = (await response.json()) as { id: string; status: string }[];
    expect(listed.map((row) => row.id)).toContain(conversationId);
    expect(listed.every((row) => row.status === "human_requested")).toBe(true);
  });

  test("a reply typed in the office reaches the customer and the transcript", async () => {
    const conversationId = await waiting();
    as = { role: "manager" };
    const before = sent.length;

    const response = await call(`/whatsapp/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Hello Amelia — Faheem here. How can we help?" }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ sent: true });
    expect(sent.slice(before)).toEqual([{ to: "+447700900321", body: "Hello Amelia — Faheem here. How can we help?" }]);

    const recorded = await rows(
      `select author, body, delivery from whatsapp_message where conversation_id = '${conversationId}' and author = 'operator'`,
    );
    expect(recorded).toEqual([
      { author: "operator", body: "Hello Amelia — Faheem here. How can we help?", delivery: "sent" },
    ]);
    // Replying takes the conversation: the assistant says nothing more.
    const [conversation] = await rows(`select status from whatsapp_conversation where id = '${conversationId}'`);
    expect(conversation!.status).toBe("human_active");
  });

  test("an empty reply is refused before it is recorded", async () => {
    const conversationId = await waiting();
    as = { role: "manager" };

    const response = await call(`/whatsapp/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "   " }),
    });

    expect(response.status).toBe(422);
  });

  test("a reader may not reply", async () => {
    const conversationId = await waiting();
    as = { role: "editor" };

    const response = await call(`/whatsapp/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Hello" }),
    });

    expect(response.status).toBe(403);
  });

  test("the office can hand a conversation back to the assistant", async () => {
    const conversationId = await waiting();
    as = { role: "manager" };

    const response = await call(`/whatsapp/conversations/${conversationId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ai_active" }),
    });

    expect(response.status).toBe(200);
    expect((await response.json()) as { status: string }).toMatchObject({ status: "ai_active" });
  });
});
