import { normaliseEmail } from "@CC-City-Chauffeurs/core";
import type { MiddlewareHandler } from "hono";

/**
 * A ceiling on wrong passwords, per account rather than per address.
 *
 * better-auth limits sign-in attempts per IP address, and that limit is real
 * for anyone calling the API directly. But the admin reaches the API through
 * its own `/api` rewrite on Vercel, so the address the API sees is one of
 * Vercel's — a different one from request to request. Through the dashboard,
 * the per-address limit never fills, and guessing an account's password is
 * limited only by how fast a script can post.
 *
 * So the count is kept against the email address being tried instead, which
 * no rotating address can change: a handful of wrong passwords for one
 * account, and that account refuses further attempts until the oldest of
 * them ages out. A correct password clears the count.
 *
 * The price is that someone who knows a staff email address can keep that
 * account locked by guessing wrong on purpose — they still learn nothing,
 * and the lock lifts on its own. A lock is a nuisance; a guessed password is
 * the admin.
 *
 * One process, one map, like `lib/rate-limit.ts`: a restart forgives
 * everyone, which is an acceptable price for having nothing else to run.
 */

/** Wrong passwords for one account before it refuses more. */
export const MAX_FAILURES = 5;

/** How long a wrong password counts against the account. */
export const FAILURE_WINDOW_MS = 15 * 60_000;

/** The most accounts tracked at once; a flood of made-up addresses shares one count beyond it. */
const MAX_TRACKED = 20_000;

/** Failure times per normalised email, oldest first. */
const failures = new Map<string, number[]>();

function recent(times: number[] | undefined, now: number) {
  return (times ?? []).filter((at) => now - at < FAILURE_WINDOW_MS);
}

function sweep(now: number) {
  for (const [email, times] of failures) {
    if (recent(times, now).length === 0) failures.delete(email);
  }
}

/** For tests: forget every count. */
export function resetSignInFailures() {
  failures.clear();
}

/**
 * Wraps better-auth's `/sign-in/email`. Reads the email from a copy of the
 * body, refuses with 429 while the account is locked, and after better-auth
 * answers, counts a 401 or clears the count on success.
 */
export const signInGuard: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== "POST") return next();

  const body = (await c.req.raw
    .clone()
    .json()
    .catch(() => null)) as { email?: unknown } | null;
  if (typeof body?.email !== "string" || !body.email.trim()) return next();

  const now = Date.now();
  if (failures.size > MAX_TRACKED) sweep(now);
  const email = normaliseEmail(body.email);
  const key = failures.has(email) || failures.size < MAX_TRACKED ? email : "overflow";

  const counted = recent(failures.get(key), now);
  if (counted.length >= MAX_FAILURES) {
    const retryAfter = Math.ceil((counted[0]! + FAILURE_WINDOW_MS - now) / 1000);
    return c.json(
      {
        code: "TOO_MANY_ATTEMPTS",
        message: `Too many wrong passwords for this account. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
      },
      429,
      { "Retry-After": String(retryAfter) },
    );
  }

  await next();

  if (c.res.status === 401) failures.set(key, [...counted, now]);
  else if (c.res.ok) failures.delete(key);
};
