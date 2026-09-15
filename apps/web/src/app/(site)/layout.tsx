import { notFound } from "next/navigation";

import { ContactBar } from "@/components/site/contact-bar";
import { Footer } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { brand } from "@/content/brand";
import { routes, type NavGroup } from "@/content/site";
import { mailLink, telLink, whatsappLink } from "@/lib/contact";
import { getServices, getSite } from "@/lib/site-data";

/**
 * The public site shell. Every marketing page renders inside it, so the
 * navigation, footer and mobile contact bar stay identical across the site —
 * and all three read the same settings, so a number changed in the admin
 * changes everywhere at once.
 */
export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [site, services] = await Promise.all([getSite(), getServices()]);
  if (!site) notFound();

  const { settings } = site;
  const published = services ?? [];

  /** The navigation dropdowns, built from the published service pages. */
  const navGroups: readonly NavGroup[] = [
    {
      label: "Chauffeur",
      href: routes.services,
      items: published.map((service) => ({
        label: service.name,
        href: routes.service(service.slug),
        note: service.summary,
      })),
    },
    {
      label: "Supercar",
      href: routes.supercarHire,
      items: [
        {
          label: "Supercar Hire",
          href: routes.supercarHire,
          note: "Self-drive hire, subject to driver eligibility and insurance.",
        },
        {
          label: "Supercar Experiences",
          href: routes.supercarExperiences,
          note: "Chauffeur-driven statement cars for arrivals and occasions.",
        },
      ],
    },
  ];

  const business = {
    name: settings.business.companyName,
    legalName: settings.business.legalName,
    phoneDisplay: settings.contact.phoneDisplay,
    whatsappDisplay: settings.contact.whatsappDisplay,
    email: settings.contact.email,
    tel: telLink(settings),
    mailto: mailLink(settings),
    whatsapp: whatsappLink(settings),
  };

  /**
   * Structured data limited to facts the client has published or confirmed:
   * name, contact details, London base and the areas served. No ratings,
   * opening hours or price range — none of them are established yet.
   */
  const siteUrl = settings.seo.siteUrl.replace(/\/+$/, "");
  const businessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}/#business`,
    name: settings.business.legalName,
    description: settings.business.positioning,
    url: siteUrl,
    telephone: settings.contact.phoneE164,
    email: settings.contact.email,
    ...(settings.seo.shareImage ? { image: `${siteUrl}${settings.seo.shareImage.src}` } : {}),
    logo: `${siteUrl}${brand.logo.src}`,
    address: {
      "@type": "PostalAddress",
      ...(settings.business.address ? { streetAddress: settings.business.address } : {}),
      addressLocality: "London",
      addressCountry: "GB",
    },
    areaServed: [
      ...settings.business.serviceAreas.map((area) => ({
        "@type": "Place",
        name: `${area}, London`,
      })),
      { "@type": "City", name: "London" },
      { "@type": "Country", name: "United Kingdom" },
      { "@type": "Place", name: "Europe" },
    ],
  };

  return (
    <div data-site className="bg-ink font-[family-name:var(--font-ui)] antialiased">
      <script
        type="application/ld+json"
        // Editor-controlled content only — no visitor input reaches this string.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }}
      />
      <a
        href="#content"
        className="label-xs sr-only fixed top-3 left-3 z-70 bg-white px-5 py-3.5 text-ink focus:not-sr-only"
      >
        Skip to content
      </a>
      <Nav groups={navGroups} business={business} />
      <main id="content" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Footer
        settings={settings}
        services={published.map((service) => ({ slug: service.slug, name: service.name }))}
      />
      <ContactBar links={{ tel: business.tel, whatsapp: business.whatsapp }} />
    </div>
  );
}
