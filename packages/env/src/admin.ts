import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    /**
     * Where the photographs managed in the admin are served from — the
     * object store's public address, including any path prefix. Read only by
     * `next.config.ts`, which lets the image optimiser fetch from it.
     */
    MEDIA_URL: z.url(),
  },
  client: {
    /** The API. */
    NEXT_PUBLIC_SERVER_URL: z.url(),
    /**
     * The website. The admin stores photographs as site-relative paths and
     * resolves them against this to preview them from its own origin.
     */
    NEXT_PUBLIC_SITE_URL: z.url(),
  },
  runtimeEnv: {
    MEDIA_URL: process.env.MEDIA_URL,
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  emptyStringAsUndefined: true,
});
