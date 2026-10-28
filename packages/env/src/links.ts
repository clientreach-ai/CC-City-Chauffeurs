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
