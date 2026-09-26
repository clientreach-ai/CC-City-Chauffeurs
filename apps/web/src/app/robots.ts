import type { MetadataRoute } from "next";

import { siteUrlOf } from "@/lib/metadata";
import { getSite } from "@/lib/site-data";

/** Points at the same domain the sitemap lists — the one set in the admin. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSite();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrlOf(site?.settings.seo)}/sitemap.xml`,
  };
}
