/**
 * Sending an email, as the rest of the server sees it.
 *
 * Vendor-neutral on purpose: exactly one file knows what an SMTP
 * conversation looks like and exactly one knows Resend's API, which is what
 * lets production swap between them with a setting, and lets every test use
 * a mailer that records instead of sends.
 *
 * Nothing here throws. An email that could not be sent is an outcome, not an
 * exception: the enquiry it was telling somebody about is already saved, and
 * losing the record because the post failed would be the worse trade.
 */

export type Email = {
  to: string;
  subject: string;
  /** Plain text. A transactional note that reads as a note, and lands in inboxes. */
  text: string;
  /** Where a reply should go — the customer, when the office is being told about them. */
  replyTo?: string;
};

export type SendOutcome =
  | { ok: true; id: string | null }
  | { ok: false; code: string; detail: string };

export interface Mailer {
  /** Which adapter — "smtp", "resend", "off", "memory". Recorded in the log. */
  readonly name: string;
  send(email: Email): Promise<SendOutcome>;
}

/** Trims a provider's complaint to something a log line can hold. */
export const MAX_DETAIL = 200;

export function failure(code: string, detail: string): SendOutcome {
  return { ok: false, code, detail: detail.slice(0, MAX_DETAIL) };
}

/**
 * The mailer when email is switched off: it agrees, and does nothing. A
 * deployment with no mail settings behaves exactly as it did before there
 * was any email at all.
 */
export class SilentMailer implements Mailer {
  readonly name = "off";
  async send(_email: Email): Promise<SendOutcome> {
    return { ok: true, id: null };
  }
}

/** Keeps what it was asked to send, for the tests to read. */
export class MemoryMailer implements Mailer {
  readonly name = "memory";
  readonly sent: Email[] = [];
  private readonly scripted: SendOutcome[] = [];

  async send(email: Email): Promise<SendOutcome> {
    this.sent.push(email);
    return this.scripted.shift() ?? { ok: true, id: `mem-${this.sent.length}` };
  }

  /** The next sends fail like this, in order, then sending resumes as normal. */
  failNext(...outcomes: SendOutcome[]): void {
    this.scripted.push(...outcomes);
  }

  clear(): void {
    this.sent.length = 0;
    this.scripted.length = 0;
  }
}
