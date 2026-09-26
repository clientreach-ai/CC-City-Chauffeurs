/**
 * Email through Resend, for production.
 *
 * Plain `fetch` rather than the SDK: one endpoint and a bearer token are not
 * worth a dependency, and an injectable `fetch` lets the tests see the exact
 * request without a network. The same reasoning as the Twilio provider.
 */

import { failure, type Email, type Mailer, type SendOutcome } from "./mailer";

export type ResendOptions = {
  apiKey: string;
  from: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

const ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_TIMEOUT_MS = 10_000;

export class ResendMailer implements Mailer {
  readonly name = "resend";
  private readonly options: ResendOptions;
  private readonly fetch: typeof fetch;

  constructor(options: ResendOptions) {
    this.options = options;
    this.fetch = options.fetch ?? fetch;
  }

  async send(email: Email): Promise<SendOutcome> {
    let response: Response;
    try {
      response = await this.fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.options.from,
          to: [email.to],
          subject: email.subject,
          text: email.text,
          ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      return timedOut
        ? failure("resend_timeout", "Resend did not answer in time.")
        : failure("resend_unreachable", "Resend could not be reached.");
    }

    const body = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (response.ok) return { ok: true, id: typeof body?.id === "string" ? body.id : null };

    // Resend's own words, never the key, and never a whole error page.
    return failure(`resend_http_${response.status}`, body?.message ?? `Resend answered ${response.status}.`);
  }
}
