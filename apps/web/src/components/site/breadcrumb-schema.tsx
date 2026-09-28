import { jsonLd } from "@/lib/json-ld";
import { siteUrlOf } from "@/lib/metadata";
import { getSite } from "@/lib/site-data";

/**
 * A page's place in the site, for search engines: BreadcrumbList structured
 * data, which Google shows as the path under a result in place of the bare
 * address. Home is always first; pass the rest of the trail, ending with the
 * page itself.
 *
 * The settings read is the same cached request the layout already made.
 */
export async function BreadcrumbSchema({ trail }: { trail: readonly { name: string; path: string }[] }) {
  const site = await getSite();
  const siteUrl = siteUrlOf(site?.settings.seo);
  const items = [{ name: "Home", path: "" }, ...trail];

  return (
    <script
      type="application/ld+json"
      // Escaped so a CMS value can never close this tag — see lib/json-ld.
      dangerouslySetInnerHTML={{
        __html: jsonLd({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: item.name,
            item: `${siteUrl}${item.path}`,
          })),
        }),
      }}
    />
  );
}
