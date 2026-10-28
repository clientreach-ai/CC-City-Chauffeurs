/**
 * Email through Resend — the only way a message leaves this server.
 *
 * Plain `fetch` rather than the SDK: one endpoint and a bearer token are not
 * worth a dependency, and an injectable `fetch` lets the tests see the exact
 * request without a network. The same reasoning as the Twilio provider.
 *
 * Retried, but narrowly. Resend allows two requests a second by default, and
 * the alerts here are each fired off on their own, so two landing together is
 * an ordinary Tuesday rather than an incident — and a rate limit nobody
 * retries is an enquiry the office never hears about. Only an answer that
 * says plainly the message was *not* taken is tried again: a rate limit, or a
 * server error. A request that timed out or never arrived is left alone,
 * because Resend may well have taken it, and the office would far rather hear
 * about an enquiry once than twice.
 */

import { failure, type Email, type Mailer, type SendOutcome } from "./mailer";

export type ResendOptions = {
  apiKey: string;
  from: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** How long to wait before trying again. Zero in the tests, so they don't. */
  retryDelayMs?: number;
};

const ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_TIMEOUT_MS = 10_000;
/** Three goes in all. The rate-limit window is a second wide; a fourth helps nobody. */
const ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1_000;

/** Resend answers `{ id }` when it took the message, and `{ name, message }` when it did not. */
type ResendReply = { id?: string; name?: string; message?: string };

/** One send, and whether it is worth another go. */
type Attempt = { outcome: SendOutcome; again: boolean };

export class ResendMailer implements Mailer {
  readonly name = "resend";
  private readonly options: ResendOptions;
  private readonly fetch: typeof fetch;

  constructor(options: ResendOptions) {
    this.options = options;
    this.fetch = options.fetch ?? fetch;
  }

  async send(email: Email): Promise<SendOutcome> {
    const body = JSON.stringify({
      from: this.options.from,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    });

    let attempt = await this.post(body);
    for (let tries = 1; attempt.again && tries < ATTEMPTS; tries += 1) {
      await this.pause(tries);
      attempt = await this.post(body);
    }
    return attempt.outcome;
  }

  private async pause(tries: number): Promise<void> {
    const delay = this.options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    if (delay <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, delay * tries));
  }

  private async post(body: string): Promise<Attempt> {
    let response: Response;
    try {
      response = await this.fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      // Nothing came back, so nobody knows whether it was sent. Left alone.
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      return {
        again: false,
        outcome: timedOut
          ? failure("resend_timeout", "Resend did not answer in time.")
          : failure("resend_unreachable", "Resend could not be reached."),
      };
    }

    const reply = (await response.json().catch(() => null)) as ResendReply | null;
    if (response.ok) {
      return { again: false, outcome: { ok: true, id: typeof reply?.id === "string" ? reply.id : null } };
    }

    // Resend's own name for what went wrong — `rate_limit_exceeded`,
    // `validation_error`, `restricted_api_key` — which says far more in a log
    // line than the status alone.
    const named = typeof reply?.name === "string" && reply.name.length > 0;
    const code = named ? `resend_${reply!.name}` : `resend_http_${response.status}`;
    return {
      again: response.status === 429 || response.status >= 500,
      outcome: failure(code, this.said(reply?.message ?? `Resend answered ${response.status}.`)),
    };
  }

  /**
   * Resend's words, with our key taken out of them.
   *
   * What goes in the log is whatever the provider said, and a provider that
   * quotes the key it just refused would put a live secret in a log file for
   * as long as that file is kept. Redacted before the detail is trimmed, so
   * no half of a key survives either.
   */
  private said(message: string): string {
    return message.replaceAll(this.options.apiKey, "[redacted]");
  }
}
