/**
 * Whether the post can go out.
 *
 * Email is the one thing in this system that reaches a person who is not
 * looking at a screen we built: the office learns a customer is waiting, and
 * a customer learns their car is confirmed. A half-configured mailer would
 * fail silently at exactly the moment it mattered, so the settings are
 * checked together at boot, the same way the WhatsApp ones are — and they are
 * checked for the mistakes that cost nothing to catch here and cannot be
 * caught at all later. A key that is not a Resend key, or a sender with no
 * address in it, is refused by Resend on every single send, and the only
 * trace is a line in a log nobody is reading.
 *
 * One provider, one seam. `resend` is the transactional service everything
 * goes through. `off` is the default, and is what every test runs with: a
 * deployment given no mail settings behaves exactly as it did before there
 * was any email at all.
 */

export type MailSettings = {
  NODE_ENV?: string;
  MAIL_PROVIDER?: "off" | "resend";
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  OFFICE_EMAIL?: string;
};

export type ConfigProblem = { path: string; message: string };

/** Deliberately loose: enough to catch a setting that is not an address at all. */
const LOOKS_LIKE_AN_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The address out of `City Chauffeurs <bookings@example.com>`, or the whole thing. */
function address(value: string): string {
  const angled = /<([^>]*)>/.exec(value);
  return (angled?.[1] ?? value).trim();
}

export function mailConfigProblems(value: MailSettings): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const missing = (path: string, why: string) => problems.push({ path, message: `${path} is required ${why}.` });
  const wrong = (path: string, message: string) => problems.push({ path, message });

  const provider = value.MAIL_PROVIDER ?? "off";
  if (provider === "off") return problems;

  const why = `when MAIL_PROVIDER is ${provider}`;

  // Who it comes from, and who hears about a new enquiry. Without either
  // there is a mailer that can send and nothing worth sending.
  if (!value.MAIL_FROM) missing("MAIL_FROM", why);
  else if (!LOOKS_LIKE_AN_ADDRESS.test(address(value.MAIL_FROM))) {
    wrong("MAIL_FROM", "MAIL_FROM must carry an address, e.g. City Chauffeurs <bookings@citychauffeurs.co.uk>.");
  }

  if (!value.OFFICE_EMAIL) missing("OFFICE_EMAIL", why);
  else if (!LOOKS_LIKE_AN_ADDRESS.test(value.OFFICE_EMAIL.trim())) {
    wrong("OFFICE_EMAIL", "OFFICE_EMAIL must be a single address, e.g. bookings@citychauffeurs.co.uk.");
  }

  if (!value.RESEND_API_KEY) missing("RESEND_API_KEY", why);
  else if (!value.RESEND_API_KEY.startsWith("re_")) {
    wrong("RESEND_API_KEY", "RESEND_API_KEY must be a Resend API key, which begins re_.");
  }

  return problems;
}
