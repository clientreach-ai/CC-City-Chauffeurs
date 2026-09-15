import { env } from "@CC-City-Chauffeurs/env/server";
import { createMiddleware } from "hono/factory";

/**
 * Tells the website that something it has cached has changed.
 *
 * It runs as middleware, after the handler, for exactly one reason: the
 * website must never be told to refresh *before* the write lands, or it will
 * dutifully cache the old content again. So the response decides — only a
 * successful mutating request purges anything, and a rejected save leaves the
 * cache alone.
 *
 * Deliberately fire-and-forget. The write has already succeeded, and the
 * website's own timed window will pick the change up regardless, so a slow or
 * unreachable site must never turn a successful save into an error on the
 * editor's screen.
 */

/** Which cached reads each part of the admin can invalidate. */
const AREAS: { match: RegExp; tags: string[] }[] = [
  { match: /^\/(vehicles|features|fleet-categories)/, tags: ["fleet", "homepage"] },
  { match: /^\/services/, tags: ["services", "site-settings", "homepage"] },
  { match: /^\/gallery/, tags: ["gallery"] },
  { match: /^\/testimonials/, tags: ["testimonials", "homepage"] },
  { match: /^\/homepage/, tags: ["homepage"] },
  { match: /^\/settings/, tags: ["site-settings", "homepage"] },
];

const MUTATIONS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function purge(tags: string[]) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !tags.length) return;

  void fetch(`${env.SITE_URL.replace(/\/+$/, "")}/api/revalidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ tags }),
  }).catch(() => {
    // The website will catch up on its own schedule.
  });
}

export const revalidateSite = createMiddleware(async (c, next) => {
  await next();

  if (!MUTATIONS.has(c.req.method)) return;
  // 2xx only: a rejected save changed nothing, so nothing needs refreshing.
  if (c.res.status < 200 || c.res.status >= 300) return;

  const path = c.req.path.replace(/^\/api\/admin/, "");
  const area = AREAS.find((entry) => entry.match.test(path));
  if (area) purge(area.tags);
});
