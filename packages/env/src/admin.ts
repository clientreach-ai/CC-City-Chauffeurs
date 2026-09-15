import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
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
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  emptyStringAsUndefined: true,
});
