/**
 * The mailer this deployment uses, built once from the environment.
 *
 * Off unless `MAIL_PROVIDER` says otherwise, so a deployment that has not
 * been given mail settings — and every test — carries on exactly as it did
 * before there was any email at all.
 */

import { env } from "@CC-City-Chauffeurs/env/server";

import { SilentMailer, type Mailer } from "./mailer";
import { ResendMailer } from "./resend";

export * from "./mailer";
export { ResendMailer } from "./resend";

function build(): Mailer {
  // Validated at boot (packages/env): the provider cannot be set without what it needs.
  return env.MAIL_PROVIDER === "resend"
    ? new ResendMailer({ apiKey: env.RESEND_API_KEY!, from: env.MAIL_FROM! })
    : new SilentMailer();
}

let current: Mailer | null = null;

/** The mailer, built on first use. */
export function mailer(): Mailer {
  current ??= build();
  return current;
}

/** For tests: swap the mailer, and put it back. */
export function useMailer(replacement: Mailer | null): void {
  current = replacement;
}
