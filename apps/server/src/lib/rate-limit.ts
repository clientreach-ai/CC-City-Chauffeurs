import type { Context, MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { every } from "hono/combine";

/**
 * What stands between the public forms and the open internet.
 *
 * Everything under `/api/admin` is behind a session; the two public writes are
 * not, and a form that records a row for anyone who asks is a form that will
 * eventually be found by something automated. Three cheap defences, in the
 * order they cost least: a cap on how large the body may be, a cap on how
 * often one address may send, and a field only a machine would fill in.
 *
 * None of them may stand in a customer's way. The limits below are set for a
 * household or an office behind one address — several people enquiring about
 * the same wedding in the same afternoon is a good day, not an attack.
 */

/**
 * A booking request is a few hundred characters of text. Sixteen kilobytes is
 * room for every field at its limit several times over, and far less than it
 * takes to make the API do any real work parsing it.
 */
const MAX_BODY_BYTES = 16 * 1024;

/** Stops a flood in seconds rather than waiting out the longer window. */
const BURST = { limit: 3, windowMs: 60_000 };

/**
 * The real ceiling. Eight in ten minutes is more than any genuine visitor
 * sends and far less than a script wants.
 */
const SUSTAINED = { limit: 8, windowMs: 10 * 60_000 };

/** Above this many tracked addresses, expired ones are swept before the next check. */
const SWEEP_ABOVE = 5_000;

/** The most addresses tracked at once, however many are live. */
const MAX_TRACKED = 50_000;

type Window = { count: number; resetAt: number };

/**
 * One process, one map. This is a single API server, so an in-memory counter
 * is the honest amount of machinery: nothing to run, nothing to fall over,
 * and a restart forgiving everyone is an acceptable price. A second instance
 * would need Redis behind the same function.
 */
const windows = new Map<string, { burst: Window; sustained: Window }>();

function sweep(now: number) {
  for (const [key, entry] of windows) {
    if (entry.burst.resetAt <= now && entry.sustained.resetAt <= now) windows.delete(key);
  }
}

function tick(window: Window, limit: number, windowMs: number, now: number) {
  if (window.resetAt <= now) {
    window.count = 0;
    window.resetAt = now + windowMs;
  }
  window.count += 1;
  return window.count > limit ? window.resetAt - now : 0;
}

/**
 * Who is asking.
 *
 * The API sits behind a reverse proxy, so the socket's own address is the
 * proxy's and every visitor would share one bucket. The forwarded headers are
 * what the proxy puts the real address in — and they are only trustworthy
 * *because* of that proxy, which overwrites whatever the client claimed. An
 * address that cannot be determined shares a single bucket rather than
 * escaping the limit altogether.
 */
function clientIp(c: Context) {
  /**
   * The *last* address, not the first. A proxy that appends (nginx's usual
   * `$proxy_add_x_forwarded_for`) leaves whatever the client sent at the
   * front, so the first entry is the visitor's own claim — and a script that
   * sends a fresh one each time would get a fresh allowance each time. The
   * last entry is the one our proxy wrote; a proxy that overwrites the header
   * leaves only that one.
   */
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").at(-1)?.trim();
    if (last) return last;
  }
  return (
    c.req.header("cf-connecting-ip")?.trim() ||
    c.req.header("x-real-ip")?.trim() ||
    "unknown"
  );
}

const limiter: MiddlewareHandler = async (c, next) => {
  const now = Date.now();
  if (windows.size > SWEEP_ABOVE) sweep(now);

  const key = clientIp(c);
  // Swept and still full means a flood of distinct addresses. Refusing to
  // track more keeps memory bounded; they share one bucket until it drains.
  const tracked = windows.has(key) || windows.size < MAX_TRACKED ? key : "overflow";
  const entry = windows.get(tracked) ?? {
    burst: { count: 0, resetAt: now + BURST.windowMs },
    sustained: { count: 0, resetAt: now + SUSTAINED.windowMs },
  };
  windows.set(tracked, entry);

  const waitMs =
    tick(entry.burst, BURST.limit, BURST.windowMs, now) ||
    tick(entry.sustained, SUSTAINED.limit, SUSTAINED.windowMs, now);

  if (waitMs > 0) {
    // Nothing about being rate limited is the customer's fault, and the reply
    // should not read as an accusation — it should tell them how to reach us.
    return c.json(
      {
        error:
          "We have had several messages from this connection in the last few minutes. " +
          "Please try again shortly, or call us and we will take the details over the phone.",
      },
      429,
      { "Retry-After": String(Math.ceil(waitMs / 1000)) },
    );
  }

  await next();
};

/**
 * Everything a public write is wrapped in. Applied to the POSTs only: the
 * reads are cached pages of published content, and throttling those would
 * throttle the website itself.
 */
export const publicWriteGuard = every(
  bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) =>
      c.json({ error: "That message is longer than this form can take. Please shorten it." }, 413),
  }),
  limiter,
);
