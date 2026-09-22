import { env } from "@CC-City-Chauffeurs/env/server";
import type { ChannelLogger, WhatsAppChannel } from "@CC-City-Chauffeurs/whatsapp/channel-types";
import type { E164 } from "@CC-City-Chauffeurs/whatsapp/ports";

import { createWhatsAppStore } from "../repositories/whatsapp";
import { createWhatsAppBackend } from "./whatsapp-backend";

/**
 * The WhatsApp channel, built once for the life of the process.
 *
 * `@CC-City-Chauffeurs/whatsapp` knows how to talk on WhatsApp and hold a
 * conversation; it has no database and no business rules. This is where the
 * server hands it both: the store is our Postgres, the backend is our
 * repositories. One business backend, WhatsApp as one more way in.
 *
 * The package is loaded only when the channel is switched on. A deployment
 * that leaves `WHATSAPP_PROVIDER` unset never loads it, the model SDK behind
 * it, or anything else it needs — it boots exactly as it did before WhatsApp
 * existed.
 *
 * One instance. This server is a single process, which the public rate
 * limiter already relies on, and the channel relies on it too: it keeps a
 * small per-conversation lock in memory so one customer's messages are
 * answered one at a time. The database is what makes a retry or a restart
 * safe — a message is recorded once and answered at most once however many
 * processes try — but a second instance would need that lock moved somewhere
 * shared before two replies to one customer could be kept in order.
 */

export type WhatsAppMode = "twilio" | "simulator";

/** Which webhook is live, or `null` when WhatsApp is switched off. */
export const whatsappMode: WhatsAppMode | null =
  env.WHATSAPP_PROVIDER === "disabled" ? null : env.WHATSAPP_PROVIDER;

/**
 * One line of JSON per event. The channel chooses what goes in `fields`, and
 * it keeps message text and contact details out of them; nothing here adds
 * any back.
 */
const log: ChannelLogger = {
  info: (event, fields) => console.info(JSON.stringify({ channel: "whatsapp", event, ...fields })),
  warn: (event, fields) => console.warn(JSON.stringify({ channel: "whatsapp", event, ...fields })),
  error: (event, fields) => console.error(JSON.stringify({ channel: "whatsapp", event, ...fields })),
};

async function build(mode: WhatsAppMode): Promise<WhatsAppChannel> {
  const whatsapp = await import("@CC-City-Chauffeurs/whatsapp");

  // Validated at boot (packages/env): a live provider cannot start without these.
  const ourNumber = env.WHATSAPP_NUMBER as E164;
  // Required for Twilio, which signs it. The simulator signs only the body.
  const webhookUrl = env.WHATSAPP_WEBHOOK_URL ?? `${env.API_URL.replace(/\/+$/, "")}/api/whatsapp/${mode}`;

  const provider =
    mode === "twilio"
      ? new whatsapp.TwilioProvider({
          accountSid: env.TWILIO_ACCOUNT_SID!,
          authToken: env.TWILIO_AUTH_TOKEN!,
          from: ourNumber,
        })
      : new whatsapp.SimulatorProvider({ secret: env.WHATSAPP_SIMULATOR_SECRET, ourNumber });

  const model =
    env.WHATSAPP_AI_PROVIDER === "scripted"
      ? new whatsapp.ScriptedModel()
      : new whatsapp.OpenAIModel({
          apiKey: env.OPENAI_API_KEY,
          model: env.WHATSAPP_AI_MODEL,
          effort: env.WHATSAPP_AI_EFFORT,
        });

  return whatsapp.createWhatsAppChannel({
    provider,
    store: createWhatsAppStore({ provider: provider.name }),
    backend: createWhatsAppBackend(),
    model,
    // The channel's own default for "today" is already London's date.
    config: { webhookUrl, ourNumber },
    log,
  });
}

let channel: Promise<WhatsAppChannel> | null = null;

/** The channel, built on first use. Only called when `whatsappMode` is set. */
export function whatsappChannel(): Promise<WhatsAppChannel> {
  if (!whatsappMode) throw new Error("WhatsApp is not enabled.");
  channel ??= build(whatsappMode).catch((error) => {
    // Let the next request try again rather than keep a failed build forever.
    channel = null;
    throw error;
  });
  return channel;
}

/**
 * Runs the assistant for each queued run, after the webhook has answered.
 *
 * Twilio gives up on a webhook after fifteen seconds and a model turn can
 * take longer, so the response goes first and the slow part happens after.
 * A run that fails is logged and left for the channel's own record of it; it
 * never reaches the request that queued it, and never the process.
 */
export function processAfterResponse(target: WhatsAppChannel, runIds: string[]) {
  for (const runId of runIds) {
    setTimeout(() => {
      target.processRun(runId).catch((error: unknown) => {
        log.error("run_failed_unhandled", { runId, error: describe(error) });
      });
    }, 0);
  }
}

/** Anything queued before the last restart. Called once at boot; never throws. */
export async function resumeWhatsApp() {
  if (!whatsappMode) return;
  try {
    await (await whatsappChannel()).resumeQueued();
  } catch (error) {
    log.error("resume_failed", { error: describe(error) });
  }
}

/** An error's name and message only: a stack can carry a query, and a query can carry a customer. */
const describe = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);
