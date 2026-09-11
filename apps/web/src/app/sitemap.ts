import type { MetadataRoute } from "next";

import { serviceSlugs } from "@/content/services";
import { site } from "@/content/site";

const base = site.url;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPaths = [
    { path: "", priority: 1 },
    { path: "/chauffeur-services", priority: 0.9 },
    { path: "/fleet", priority: 0.9 },
    { path: "/request-a-quote", priority: 0.9 },
    { path: "/contact", priority: 0.8 },
    { path: "/gallery", priority: 0.7 },
    { path: "/about", priority: 0.7 },
    { path: "/supercar-hire", priority: 0.6 },
    { path: "/supercar-experiences", priority: 0.6 },
  ];

  return [
    ...staticPaths.map(({ path, priority }) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority,
    })),
    ...serviceSlugs.map((slug) => ({
      url: `${base}/chauffeur-services/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
