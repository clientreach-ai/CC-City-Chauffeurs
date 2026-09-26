import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * The website's settings, checked when `next.config.ts` loads — so a build
 * with a missing or malformed value fails before a page is generated.
 *
 * Server code only. Browser code reads `process.env.NEXT_PUBLIC_*` directly:
 * importing this module into a client component ships the whole of Zod to
 * every visitor to check one string that was already checked at build time.
 */
export const env = createEnv({
  server: {
    /**
     * Where the photographs managed in the admin are served from — the
     * object store's public address, including any path prefix. The image
     * optimiser accepts nothing from any other host.
     */
    MEDIA_URL: z.url(),
    /**
     * Shared with the API, which uses it to ask for a page refresh after an
     * edit. Required for a production build: without it every edit waits out
     * the one-minute window instead of showing at once, and nothing says so.
     */
    REVALIDATE_SECRET:
      process.env.NODE_ENV === "production" ? z.string().min(16) : z.string().optional(),
  },
  client: {
    /** The API. */
    NEXT_PUBLIC_SERVER_URL: z.url(),
  },
  runtimeEnv: {
    MEDIA_URL: process.env.MEDIA_URL,
    REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
  },
  emptyStringAsUndefined: true,
});
