/**
 * A WhatsApp provider that is not WhatsApp.
 *
 * It is a real provider, not a mock: it verifies, parses and sends through
 * the same interface Twilio does, so everything above it — deduplication,
 * routing, the assistant, delivery records — runs exactly as it would in
 * production. What differs is only the wire. Inbound messages arrive in a
 * small JSON format of its own, and outbound ones are kept in `sent` rather
 * than delivered, which is how the tests and the local simulator see what
 * the assistant said.
 *
 *     { "messages": [{ "id": "sim-1", "from": "+447700900321",
 *       "to": "+442084433332", "name": "Amelia", "type": "text",
 *       "text": "Hello" }] }
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { InvalidPhoneNumberError, normalisePhone } from "../phone";
import {
  type E164,
  type InboundMessage,
  type OutboundMessage,
  type SendResult,
  WebhookAuthenticationError,
  WebhookPayloadError,
  type WhatsAppProvider,
} from "../ports";

export type SimulatorProviderOptions = {
  /**
   * When set, every webhook must be signed with it. When not, anything posted
   * is accepted — which is only acceptable on a developer's own machine, so
   * production must either set a secret or not mount the simulator at all.
   */
  secret?: string;
  /** The number the simulated customers write to, used when a message leaves `to` out. */
  ourNumber: E164;
};

/** More than any test or person at a keyboard sends at once, and bounded so a runaway script is refused. */
const MAX_MESSAGES = 50;

/** The same ceiling WhatsApp itself puts on a message. */
const MAX_TEXT_LENGTH = 4096;

const SIGNATURE_PREFIX = "sha256=";

const payloadSchema = z
  .object({
    messages: z
      .array(
        z
          .object({
            id: z.string().min(1).max(200),
            from: z.string().min(1).max(40),
            to: z.string().min(1).max(40).optional(),
            name: z.string().max(200).optional(),
            type: z.string().min(1).max(40),
            text: z.string().max(MAX_TEXT_LENGTH).optional(),
          })
          .strict(),
      )
      .max(MAX_MESSAGES),
  })
  .strict();

/**
 * The value for `X-Simulator-Signature`: `sha256=` and the hex HMAC-SHA256 of
 * the raw body. Exported so the local simulator and tests can sign what they post.
 */
export function simulatorSignature(body: string, secret: string): string {
  return SIGNATURE_PREFIX + createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

export class SimulatorProvider implements WhatsAppProvider {
  readonly name = "simulator";

  /** Every message the assistant or the office has sent, oldest first. */
  readonly sent: OutboundMessage[] = [];

  private readonly secret: string | undefined;
  private readonly ourNumber: E164;
  private readonly scripted: SendResult[] = [];
  private sequence = 0;

  constructor(options: SimulatorProviderOptions) {
    this.secret = options.secret;
    this.ourNumber = options.ourNumber;
  }

  verifySignature(request: { url: string; body: string; headers: Headers }): void {
    if (this.secret === undefined) return;
    const received = request.headers.get("x-simulator-signature");
    if (!received) throw new WebhookAuthenticationError();
    const expected = Buffer.from(simulatorSignature(request.body, this.secret), "utf8");
    const actual = Buffer.from(received, "utf8");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new WebhookAuthenticationError();
    }
  }

  parseInbound(body: string): InboundMessage[] {
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new WebhookPayloadError("The body is not JSON.");
    }
    const parsed = payloadSchema.safeParse(json);
    if (!parsed.success) throw new WebhookPayloadError("The body is not a simulator payload.");

    const receivedAt = new Date();
    return parsed.data.messages.map((message) => {
      let from: E164;
      let to: E164;
      try {
        from = normalisePhone(message.from);
        to = message.to === undefined ? this.ourNumber : normalisePhone(message.to);
      } catch (error) {
        if (error instanceof InvalidPhoneNumberError) {
          throw new WebhookPayloadError("A message has an invalid telephone number.");
        }
        throw error;
      }
      return {
        provider: this.name,
        providerMessageId: message.id,
        to,
        from,
        profileName: message.name?.trim() || null,
        // Other types exist so the unsupported path can be exercised the way
        // a photograph from a real phone would exercise it.
        kind: message.type === "text" && (message.text ?? "").trim() !== "" ? "text" : "unsupported",
        text: message.text ?? "",
        receivedAt,
      };
    });
  }

  acknowledgement() {
    return { contentType: "application/json", body: '{"ok":true}' };
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    const scripted = this.scripted.shift();
    if (scripted && !scripted.ok) return scripted;
    // A failed send is not recorded as sent: WhatsApp would not have delivered it either.
    this.sent.push({ ...message });
    if (scripted) return scripted;
    this.sequence += 1;
    return { ok: true, providerMessageId: `sim-out-${this.sequence}` };
  }

  /** The next sends return these, in order, before sending resumes as normal. */
  failNext(...results: SendResult[]): void {
    this.scripted.push(...results);
  }

  /** Forgets what was sent and anything scripted, for the next test. */
  clear(): void {
    this.sent.length = 0;
    this.scripted.length = 0;
    this.sequence = 0;
  }
}
