import type { MetadataRoute } from "next";

import { siteUrlOf } from "@/lib/metadata";
import { getServices, getSite } from "@/lib/site-data";

/** Rebuilt every hour, so a newly published service page gets listed. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [settings, services] = await Promise.all([getSite(), getServices()]);
  const base = siteUrlOf(settings?.settings.seo);

  const staticPaths = [
    { path: "", priority: 1 },
    { path: "/chauffeur-services", priority: 0.9 },
    { path: "/fleet", priority: 0.9 },
    { path: "/request-a-chauffeur", priority: 0.9 },
    { path: "/contact", priority: 0.8 },
    { path: "/gallery", priority: 0.7 },
    { path: "/about", priority: 0.7 },
    { path: "/supercar-hire", priority: 0.6 },
    { path: "/supercar-experiences", priority: 0.6 },
  ];

  return [
    // No lastModified on these: stamping them with the time the sitemap was
    // generated tells a crawler every page changed hourly, which it learns
    // to ignore.
    ...staticPaths.map(({ path, priority }) => ({
      url: `${base}${path}`,
      changeFrequency: "monthly" as const,
      priority,
    })),
    // Only published services — a draft must not be advertised to a crawler.
    ...(services ?? []).map((service) => ({
      url: `${base}/chauffeur-services/${service.slug}`,
      lastModified: new Date(service.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
