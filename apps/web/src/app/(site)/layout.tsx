import { ContactBar } from "@/components/site/contact-bar";
import { Footer } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { brand } from "@/content/brand";
import { navGroups } from "@/content/navigation";
import { shareImage } from "@/content/seo";
import { contact, serviceAreas, site } from "@/content/site";

/**
 * Structured data limited to facts the client has published or confirmed:
 * name, contact details, London base and the areas served. No ratings,
 * opening hours or price range — none of them are established yet.
 */
const businessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${site.url}/#business`,
  name: site.legalName,
  description: site.positioning,
  url: site.url,
  telephone: contact.phoneE164,
  email: contact.email,
  image: `${site.url}${shareImage.url}`,
  logo: `${site.url}${brand.logo.src}`,
  address: {
    "@type": "PostalAddress",
    addressLocality: "London",
    addressCountry: "GB",
  },
  areaServed: [
    ...serviceAreas.map((area) => ({ "@type": "Place", name: `${area}, London` })),
    { "@type": "City", name: "London" },
    { "@type": "Country", name: "United Kingdom" },
    { "@type": "Place", name: "Europe" },
  ],
};

/**
 * The public site shell. Every marketing page renders inside it, so the
 * navigation, footer and mobile contact bar stay identical across the site.
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-site className="bg-ink font-[family-name:var(--font-ui)] antialiased">
      <script
        type="application/ld+json"
        // Static, author-controlled object — no user input reaches this string.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }}
      />
      <Nav groups={navGroups} />
      <main>{children}</main>
      <Footer />
      <ContactBar />
    </div>
  );
}
