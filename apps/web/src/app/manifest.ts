import type { MetadataRoute } from "next";

import { getSite } from "@/lib/site-data";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const site = await getSite();
  const seo = site?.settings.seo;

  return {
    name: seo?.siteTitle || "City Chauffeurs",
    short_name: site?.settings.business.companyName || "City Chauffeurs",
    description: seo?.defaultDescription || "Luxury chauffeur service in London.",
    start_url: "/",
    display: "browser",
    background_color: "#0b0b0c",
    theme_color: "#060607",
    icons: [
      { src: "/icon.png", sizes: "any", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
