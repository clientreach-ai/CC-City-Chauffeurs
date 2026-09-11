import { ContactBar } from "@/components/site/contact-bar";
import { Footer } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { navGroups } from "@/content/navigation";
import { contact, site } from "@/content/site";

/** Structured data limited to facts published on the client's existing site. */
const businessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: site.legalName,
  description: site.positioning,
  telephone: contact.phoneE164,
  email: contact.email,
  url: site.url,
  address: {
    "@type": "PostalAddress",
    addressLocality: "London",
    addressCountry: "GB",
  },
  areaServed: ["London", "United Kingdom", "Europe"],
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
