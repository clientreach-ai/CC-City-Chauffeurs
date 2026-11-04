/**
 * Where the links the API sends out point.
 *
 * `ADMIN_URL` starts every team invitation link and every alert's link to a
 * record. It defaults to localhost so a developer's machine needs nothing
 * set — but a production API left on that default boots happily and then
 * emails links nobody can open, with nothing anywhere to say so. In
 * production it has to be a real address, and that is checked at boot.
 */

export type LinkSettings = {
  NODE_ENV?: string;
  ADMIN_URL?: string;
};

export type ConfigProblem = { path: string; message: string };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

export function linkConfigProblems(value: LinkSettings): ConfigProblem[] {
  if (value.NODE_ENV !== "production" || !value.ADMIN_URL || !URL.canParse(value.ADMIN_URL)) return [];
  const { hostname } = new URL(value.ADMIN_URL);
  if (!LOCAL_HOSTS.has(hostname)) return [];
  return [
    {
      path: "ADMIN_URL",
      message:
        "ADMIN_URL must be the admin's public address in production, e.g. https://admin.citychauffeurs.co.uk — every invitation link starts with it.",
    },
  ];
}

/**
 * Where the admin is served from — the only pages trusted to act as a
 * signed-in member of staff.
 *
 * `CORS_ORIGIN` lists every page allowed to call the API, the website's
 * included, because the website posts its enquiry form. But the website is
 * not the admin. While it lives on vercel.app it is cross-site to the
 * dashboard and the browser keeps the session cookie from it; once it moves
 * to cccitychauffeurs.co.uk it is the same *site* as
 * dashboard.cccitychauffeurs.co.uk, the cookie goes along, and any script
 * running on the website — a compromised dependency, an injected tag — could
 * read and write the admin with a staff member's session, if the website's
 * origin were trusted for it.
 *
 * So in production the admin's trust is `ADMIN_URL`'s origin alone. Anywhere
 * else every `CORS_ORIGIN` is trusted too, so a developer's admin on another
 * local port keeps working without setting anything.
 */
export function adminOrigins(value: { NODE_ENV?: string; ADMIN_URL: string; CORS_ORIGIN: string[] }): string[] {
  const admin = new URL(value.ADMIN_URL).origin;
  if (value.NODE_ENV === "production") return [admin];
  return [...new Set([admin, ...value.CORS_ORIGIN])];
}
