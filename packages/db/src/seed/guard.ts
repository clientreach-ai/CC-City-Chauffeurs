/**
 * Whether the seed may run against this database.
 *
 * The seed empties and rewrites every content table, and with `--samples` or
 * `--reset-ops` it deletes every enquiry, booking and customer first. It
 * reads its address from `apps/server/.env` — the same file a developer
 * points at whatever database they last needed. Pointed at production, the
 * README's own setup step would wipe the client's real enquiries and every
 * edit they have made in the admin, with nothing to say so.
 *
 * So it runs only against a database on this machine (or a local container,
 * named without dots) unless the host it is about to rewrite is named
 * outright: `SEED_DATABASE_HOST=<host> pnpm db:seed`. Naming it is the
 * point — a flag that merely says "yes" gets added to a command out of habit.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Why the seed must not run, or null when it may. */
export function seedRefusal(databaseUrl: string | undefined, allowedHost: string | undefined): string | null {
  if (!databaseUrl) return "DATABASE_URL is not set — the seed has nowhere to write.";
  if (!URL.canParse(databaseUrl)) return "DATABASE_URL is not a URL the seed can read a host from.";

  const host = new URL(databaseUrl).hostname;
  if (LOCAL_HOSTS.has(host) || !host.includes(".")) return null;
  if (allowedHost?.trim() === host) return null;

  return [
    `Refusing to seed ${host}: it is not a database on this machine.`,
    "The seed rewrites every content table, and --samples or --reset-ops deletes every enquiry, booking and customer.",
    "If this is production, stop. If it is a database you mean to rewrite, name it:",
    `  SEED_DATABASE_HOST=${host} pnpm db:seed`,
  ].join("\n");
}
