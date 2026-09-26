/**
 * Email through any mail server.
 *
 * What this is for: a Gmail account with an app password, while the client
 * watches the first alerts arrive. It is not what production should send a
 * customer's confirmation through — a personal mailbox has daily limits and
 * a reputation that belongs to a person rather than the business — which is
 * what `resend.ts` is for.
 *
 * The transport is built once, on first use, so a deployment that never
 * sends an email never opens a connection.
 */

import nodemailer, { type Transporter } from "nodemailer";

import { failure, type Email, type Mailer, type SendOutcome } from "./mailer";

export type SmtpOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  /** For tests: a transport that is not the real one. */
  transport?: Pick<Transporter, "sendMail">;
};

export class SmtpMailer implements Mailer {
  readonly name = "smtp";
  private readonly options: SmtpOptions;
  private transport: Pick<Transporter, "sendMail"> | null;

  constructor(options: SmtpOptions) {
    this.options = options;
    this.transport = options.transport ?? null;
  }

  private connection() {
    this.transport ??= nodemailer.createTransport({
      host: this.options.host,
      port: this.options.port,
      // 587 is STARTTLS: the connection begins in the clear and is upgraded.
      // 465 is TLS from the first byte.
      secure: this.options.port === 465,
      auth: { user: this.options.user, pass: this.options.password },
    });
    return this.transport;
  }

  async send(email: Email): Promise<SendOutcome> {
    try {
      const sent = await this.connection().sendMail({
        from: this.options.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        ...(email.replyTo ? { replyTo: email.replyTo } : {}),
      });
      return { ok: true, id: typeof sent?.messageId === "string" ? sent.messageId : null };
    } catch (error) {
      // Built from the server's reply, which never repeats the password.
      const message = error instanceof Error ? error.message : "The mail server refused the message.";
      const code = (error as { code?: string } | null)?.code;
      return failure(code ? `smtp_${String(code).toLowerCase()}` : "smtp_failed", message);
    }
  }
}
