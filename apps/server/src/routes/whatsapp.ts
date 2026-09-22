import type { WhatsAppChannel } from "@CC-City-Chauffeurs/whatsapp/channel-types";
import type { ConversationStatus } from "@CC-City-Chauffeurs/whatsapp/ports";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";

import { webhookRateLimit } from "../lib/rate-limit";
import { requires, type Variables } from "../lib/session";
import { processAfterResponse, type WhatsAppMode } from "../lib/whatsapp";
import * as whatsapp from "../repositories/whatsapp";

/**
 * WhatsApp, as the API serves it.
 *
 * Two surfaces. The webhook is what the provider posts each message to; it
 * has no session, no cookie and no CORS, because the caller is Twilio and not
 * a browser, and its only credential is the signature the channel checks. The
 * admin routes are the office's view of the same conversations, behind the
 * session like everything else under /api/admin.
 *
 * Neither is mounted when WhatsApp is switched off: every path here is then a
 * 404, reads included, so the admin can tell "off" from "on and quiet".
 */

/**
 * A WhatsApp message is at most 4,096 characters and Twilio's form around it
 * a few hundred bytes more. Sixty-four kilobytes is room for that many times
 * over, and is enforced before the body is read — from `Content-Length` when
 * the provider sends one, and by counting as it streams when it does not.
 */
const MAX_WEBHOOK_BYTES = 64 * 1024;

const STATUSES = [
  "ai_active",
  "human_requested",
  "human_active",
  "closed",
] as const satisfies readonly ConversationStatus[];

/**
 * The webhook. The body is handed to the channel as the raw text it arrived
 * as: the provider's signature is computed over those exact bytes, and a
 * body parsed and re-encoded on the way would never verify.
 */
export function whatsappWebhookRoutes(mode: WhatsAppMode, channel: () => Promise<WhatsAppChannel>) {
  return new Hono().post(
    `/${mode}`,
    webhookRateLimit,
    bodyLimit({
      maxSize: MAX_WEBHOOK_BYTES,
      onError: (c) => c.text("Payload too large.", 413),
    }),
    async (c) => {
      const body = await c.req.text();
      const target = await channel();
      const result = await target.ingest({ body, headers: c.req.raw.headers });
      // Answered first, run afterwards: see `processAfterResponse`.
      processAfterResponse(target, result.runIds);
      return c.body(result.body, result.status as ContentfulStatusCode, {
        "Content-Type": result.contentType,
      });
    },
  );
}

const operatorMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write the message first.")
    .max(4096, "WhatsApp takes at most 4,096 characters in one message."),
});

const statusUpdateSchema = z.object({ status: z.enum(STATUSES) });

/**
 * The office's view. Reads need `operations.view`; replying or moving a
 * conversation needs `operations.edit`.
 */
export function whatsappAdminRoutes(channel: () => Promise<WhatsAppChannel>) {
  return new Hono<{ Variables: Variables }>()
    .get("/whatsapp/conversations", requires("operations.view"), async (c) => {
      const status = c.req.query("status");
      const filter = status ? z.enum(STATUSES).parse(status) : undefined;
      return c.json(await whatsapp.listConversations(filter));
    })

    .get("/whatsapp/conversations/:id", requires("operations.view"), async (c) =>
      c.json(await whatsapp.getConversationDetail(c.req.param("id"))),
    )

    /**
     * A reply typed in the office. The channel records it before it sends it,
     * so the transcript shows what was said even when delivery fails — and
     * the answer says which it was, because "sent" must never be assumed.
     */
    .post("/whatsapp/conversations/:id/messages", requires("operations.edit"), async (c) => {
      const { body } = operatorMessageSchema.parse(await c.req.json());
      const result = await (await channel()).sendOperatorMessage(c.req.param("id"), body);
      return c.json(
        result.ok
          ? { sent: true as const }
          : {
              sent: false as const,
              code: result.code,
              retryable: result.retryable,
              detail: result.detail,
            },
        201,
      );
    })

    .patch("/whatsapp/conversations/:id/status", requires("operations.edit"), async (c) => {
      const { status } = statusUpdateSchema.parse(await c.req.json());
      await (await channel()).setStatus(c.req.param("id"), status);
      return c.json(await whatsapp.getConversationDetail(c.req.param("id")));
    });
}
