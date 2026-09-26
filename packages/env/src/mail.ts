/**
 * Whether the post can go out.
 *
 * Email is the one thing in this system that reaches a person who is not
 * looking at a screen we built: the office learns a customer is waiting, and
 * a customer learns their car is confirmed. A half-configured mailer would
 * fail silently at exactly the moment it mattered, so the settings are
 * checked together at boot, the same way the WhatsApp ones are.
 *
 * Two providers, one seam. `smtp` is anybody's mail server — a Gmail account
 * with an app password while this is being tried out. `resend` is the
 * transactional service for production, where a shared inbox's sending
 * limits and spam reputation are not what the client's confirmations should
 * depend on. `off` is the default, and is what every test runs with.
 */

export type MailSettings = {
  NODE_ENV?: string;
  MAIL_PROVIDER?: "off" | "smtp" | "resend";
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  OFFICE_EMAIL?: string;
};

export type ConfigProblem = { path: string; message: string };

export function mailConfigProblems(value: MailSettings): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const missing = (path: string, why: string) => problems.push({ path, message: `${path} is required ${why}.` });

  const provider = value.MAIL_PROVIDER ?? "off";
  if (provider === "off") return problems;

  const why = `when MAIL_PROVIDER is ${provider}`;
  // Who it comes from, and who hears about a new enquiry. Without either
  // there is a mailer that can send and nothing worth sending.
  if (!value.MAIL_FROM) missing("MAIL_FROM", why);
  if (!value.OFFICE_EMAIL) missing("OFFICE_EMAIL", why);

  if (provider === "smtp") {
    if (!value.SMTP_HOST) missing("SMTP_HOST", why);
    if (!value.SMTP_USER) missing("SMTP_USER", why);
    if (!value.SMTP_PASSWORD) missing("SMTP_PASSWORD", why);
  }

  if (provider === "resend" && !value.RESEND_API_KEY) missing("RESEND_API_KEY", why);

  return problems;
}
