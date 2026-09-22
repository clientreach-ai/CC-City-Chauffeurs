import { env } from "@CC-City-Chauffeurs/env/server";

/**
 * Where the website's own photography is served from once seeded.
 *
 * The content files name each photograph by the path it had under the
 * website's `public/` folder: "/media/fleet-cullinan.jpg". In the bucket it
 * sits at that same path under this site's prefix, so both the key and the
 * address are mechanical. The seed writes the addresses; the one-off script
 * in `apps/server/scripts/migrate-media-to-r2.ts` is what put the files
 * there, and can be run again to put back any that have since been deleted.
 */

/** The key a public path is stored under: "/media/x.jpg" → "<prefix>/media/x.jpg". */
export function storedKey(path: string) {
  return `${env.R2_PREFIX}/${path.replace(/^\/+/, "")}`;
}

/** The address a public path is served from now. */
export function storedSrc(path: string) {
  return `${env.R2_PUBLIC_BASE_URL}/${storedKey(path).split("/").map(encodeURIComponent).join("/")}`;
}
