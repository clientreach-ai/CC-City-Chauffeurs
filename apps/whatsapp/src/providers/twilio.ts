/**
 * WhatsApp through Twilio.
 *
 * Translation and transport only. This file knows how Twilio signs a webhook,
 * how it spells an inbound message and how to ask it to send one; it does not
 * know whether a message has been seen before or what to say in reply. Both of
 * those happen above it, the same way for every provider.
 *
 * It speaks to Twilio's REST API with plain `fetch` rather than Twilio's SDK:
 * one endpoint and one signature scheme are not worth a large dependency, and
 * an injectable `fetch` lets the tests see every request exactly as sent.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { normalisePhone, stripWhatsAppPrefix } from "../phone";
import {
  type E164,
  type InboundMessage,
  type OutboundMessage,
  type SendResult,
  WebhookAuthenticationError,
  WebhookPayloadError,
  type WhatsAppProvider,
} from "../ports";

export type TwilioProviderOptions = {
  accountSid: string;
  authToken: string;
  /** Our WhatsApp sender, as Twilio knows it. */
  from: E164;
  /** Injectable so the tests can see requests without a network. */
  fetch?: typeof fetch;
  /** How long to wait for Twilio before treating the send as failed. */
  timeoutMs?: number;
};

/**
 * WhatsApp allows 4,096 characters in a message. Anything longer did not come
 * from a customer's phone, and the model is not shown more than that.
 */
const MAX_TEXT_LENGTH = 4096;

/**
 * Long enough for Twilio on a bad day, short enough that a reply that has
 * clearly failed is recorded as failed while the run is still fresh.
 */
const DEFAULT_TIMEOUT_MS = 10_000;

/** Twilio's own messages can be long; the stored detail only needs the gist. */
const MAX_DETAIL_LENGTH = 200;

/**
 * The signature Twilio puts in `X-Twilio-Signature` for a form-encoded POST.
 *
 * Twilio takes the full URL it called, exactly as configured — scheme, host,
 * path and any query string — then appends each POST parameter's name and
 * value, sorted by name, with nothing in between. That string is signed with
 * HMAC-SHA1 under the account's auth token and sent in base64.
 *
 * A name that appears more than once contributes every one of its values, in
 * the order they were sent; the sort is stable, so only names are reordered.
 * Twilio does not send repeated names in a WhatsApp webhook, so this is the
 * cautious reading rather than one a real request has tested.
 *
 * Exported so tests, here and in the server, can sign a request the way
 * Twilio would.
 */
export function twilioSignature(
  url: string,
  params: URLSearchParams | Record<string, string> | Iterable<readonly [string, string]>,
  authToken: string,
): string {
  const entries: [string, string][] =
    params instanceof URLSearchParams
      ? [...params.entries()]
      : Symbol.iterator in params
        ? [...(params as Iterable<readonly [string, string]>)].map(([k, v]) => [k, v])
        : Object.entries(params as Record<string, string>);

  // Compared by code unit rather than locale, which is what Twilio's own
  // libraries do; a locale-aware sort would disagree on mixed case.
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  let payload = url;
  for (const [name, value] of entries) payload += name + value;
  return createHmac("sha1", authToken).update(payload, "utf8").digest("base64");
}

/** Equal-time comparison. Strings of different lengths are simply unequal. */
function signaturesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function readNumber(params: URLSearchParams, name: string): E164 {
  const raw = params.get(name);
  if (!raw) throw new WebhookPayloadError(`The message has no ${name}.`);
  try {
    return normalisePhone(stripWhatsAppPrefix(raw));
  } catch {
    throw new WebhookPayloadError(`The message's ${name} is not a valid telephone number.`);
  }
}

export class TwilioProvider implements WhatsAppProvider {
  readonly name = "twilio";

  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly from: E164;
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: TwilioProviderOptions) {
    this.accountSid = options.accountSid;
    this.authToken = options.authToken;
    this.from = options.from;
    this.fetch = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  verifySignature(request: { url: string; body: string; headers: Headers }): void {
    // `Headers.get` is already case-insensitive, which is what HTTP requires.
    const received = request.headers.get("x-twilio-signature");
    // One error for every failure: a caller probing the webhook learns
    // nothing about which part of its forgery was wrong.
    if (!received) throw new WebhookAuthenticationError();
    const expected = twilioSignature(request.url, new URLSearchParams(request.body), this.authToken);
    if (!signaturesMatch(expected, received)) throw new WebhookAuthenticationError();
  }

  parseInbound(body: string): InboundMessage[] {
    const params = new URLSearchParams(body);

    // Delivery receipts arrive at the same address if Twilio is configured
    // that way. They are not messages, and refusing them would only make
    // Twilio retry, so they are acknowledged and ignored.
    if (params.has("MessageStatus") && !params.has("Body")) return [];

    const providerMessageId = params.get("MessageSid") || params.get("SmsMessageSid");
    if (!providerMessageId) throw new WebhookPayloadError("The message has no MessageSid.");

    const from = readNumber(params, "From");
    const to = readNumber(params, "To");

    const text = (params.get("Body") ?? "").slice(0, MAX_TEXT_LENGTH);
    const numMedia = Number.parseInt(params.get("NumMedia") ?? "0", 10);
    // A photograph or voice note may carry a caption, which is kept for the
    // transcript, but the message as a whole is not one we can read in V1.
    const kind = (Number.isFinite(numMedia) && numMedia > 0) || text.trim() === "" ? "unsupported" : "text";

    const profileName = params.get("ProfileName")?.trim() || null;

    return [
      {
        provider: this.name,
        providerMessageId,
        to,
        from,
        profileName,
        kind,
        text,
        receivedAt: new Date(),
      },
    ];
  }

  /**
   * Twilio reads the webhook's response as TwiML and would send any message
   * in it. The reply is sent separately once the assistant has one, so the
   * acknowledgement says nothing at all.
   */
  acknowledgement() {
    return { contentType: "text/xml", body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>' };
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`;
    const form = new URLSearchParams({
      From: `whatsapp:${this.from}`,
      To: `whatsapp:${message.to}`,
      Body: message.body,
    });

    let response: Response;
    try {
      response = await this.fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: form.toString(),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      // Neither case tells us whether Twilio accepted the message, but a
      // repeat is better than a customer left without an answer.
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        return { ok: false, retryable: true, code: "provider_timeout", detail: "Twilio did not answer in time." };
      }
      return { ok: false, retryable: true, code: "provider_unreachable", detail: "Twilio could not be reached." };
    }

    const json = await readJson(response);

    if (response.ok) {
      const sid = typeof json?.sid === "string" ? json.sid : null;
      if (sid) return { ok: true, providerMessageId: sid };
      // Twilio said yes but did not say what to call the message. It has
      // probably gone, so sending again would risk saying it twice.
      return {
        ok: false,
        retryable: false,
        code: "provider_bad_response",
        detail: "Twilio accepted the message but returned no id.",
      };
    }

    // Too many requests, or trouble on Twilio's side, may pass; anything else
    // in the 4xx range — a number outside the 24-hour window, a number that
    // is not on WhatsApp — will fail the same way however often it is tried.
    const retryable = response.status === 429 || response.status >= 500;
    const twilioCode = typeof json?.code === "number" || typeof json?.code === "string" ? String(json.code) : null;
    const twilioMessage = typeof json?.message === "string" ? json.message : "";
    const detail = `Twilio answered ${response.status}${twilioMessage ? `: ${twilioMessage}` : "."}`;

    return {
      ok: false,
      retryable,
      code: twilioCode ? `twilio_${twilioCode}` : `http_${response.status}`,
      // Built only from Twilio's reply, which never repeats the credentials,
      // and trimmed so a long error page does not end up in the transcript.
      detail: detail.slice(0, MAX_DETAIL_LENGTH),
    };
  }
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
