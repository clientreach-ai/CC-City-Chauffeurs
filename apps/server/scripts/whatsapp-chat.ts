/**
 * Talk to the WhatsApp assistant from a terminal.
 *
 * Every line typed is delivered as an inbound WhatsApp message through the
 * simulator provider, and the reply is printed. Everything behind that is the
 * real thing: the channel, the model, the conversation store, and the
 * repositories that write enquiries and bookings — so an enquiry made here is
 * in the admin under Enquiries, marked WhatsApp, like any other.
 *
 *   bun run scripts/whatsapp-chat.ts [--from +447700900123]
 *
 * It refuses to run unless DATABASE_URL points at this machine. A chat here
 * writes customers, enquiries and bookings; those belong in a local database,
 * never in the client's.
 *
 * The catalogue the assistant reads is whatever the local database holds —
 * `pnpm db:migrate && pnpm db:seed` fills it from the website's own content.
 */

import { env } from "@CC-City-Chauffeurs/env/server";
import {
  AnthropicModel,
  createWhatsAppChannel,
  normalisePhone,
  SimulatorProvider,
  type E164,
} from "@CC-City-Chauffeurs/whatsapp";
import { createInterface } from "node:readline/promises";

import { createWhatsAppBackend } from "../src/lib/whatsapp-backend";
import { createWhatsAppStore } from "../src/repositories/whatsapp";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function databaseHost() {
  try {
    return new URL(env.DATABASE_URL).hostname;
  } catch {
    return "";
  }
}

if (!LOCAL_HOSTS.has(databaseHost())) {
  console.error(
    `DATABASE_URL points at ${databaseHost() || "an unreadable address"}, not this machine.\n` +
      "This script writes customers, enquiries and bookings. Point it at a local database:\n" +
      "  DATABASE_URL=postgres://postgres:postgres@localhost:5432/city_chauffeurs bun run scripts/whatsapp-chat.ts",
  );
  process.exit(1);
}

if (!env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set — the assistant has nothing to think with.");
  process.exit(1);
}

const fromFlag = process.argv.indexOf("--from");
const customer = normalisePhone(fromFlag > -1 ? process.argv[fromFlag + 1]! : "+447700900123");
const ourNumber = (env.WHATSAPP_NUMBER ?? "+442084433332") as E164;

const provider = new SimulatorProvider({ ourNumber });
const channel = createWhatsAppChannel({
  provider,
  store: createWhatsAppStore({ provider: provider.name }),
  backend: createWhatsAppBackend(),
  model: new AnthropicModel({ apiKey: env.ANTHROPIC_API_KEY, model: env.WHATSAPP_AI_MODEL, effort: env.WHATSAPP_AI_EFFORT }),
  config: { webhookUrl: "http://localhost/api/whatsapp/simulator", ourNumber },
  // The channel's events, where a developer can see them without the text.
  log: {
    info: (event, fields) => console.debug(`  · ${event}`, fields ?? ""),
    warn: (event, fields) => console.warn(`  ! ${event}`, fields ?? ""),
    error: (event, fields) => console.error(`  ✗ ${event}`, fields ?? ""),
  },
});

console.log(`Chatting as ${customer} with ${env.WHATSAPP_AI_MODEL}. An empty line or Ctrl+D ends it.\n`);

const terminal = createInterface({ input: process.stdin, output: process.stdout });
let sequence = 0;

while (true) {
  let text: string;
  try {
    text = (await terminal.question("you  › ")).trim();
  } catch {
    break;
  }
  if (!text) break;

  const already = provider.sent.length;
  const body = JSON.stringify({
    messages: [{ id: `SIM${Date.now()}${sequence++}`, from: customer, to: ourNumber, name: "Local Test", type: "text", text }],
  });
  const { runIds } = await channel.ingest({ body, headers: new Headers() });
  for (const runId of runIds) await channel.processRun(runId);

  const replies = provider.sent.slice(already);
  if (!replies.length) console.log("       (no reply — the conversation is with a person now)");
  for (const reply of replies) console.log(`\ncc   › ${reply.body}\n`);
}

terminal.close();
process.exit(0);
