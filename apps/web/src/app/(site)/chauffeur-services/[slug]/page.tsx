import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHero } from "@/components/site/page-hero";
import { GhostLink, QuietLink, SectionHead } from "@/components/site/primitives";
import {
  EditorialSplit,
  EnquiryBand,
  IndexRows,
  QuoteBrief,
  Section,
  Statement,
  StatementBand,
  VehicleStrip,
} from "@/components/site/sections";
import { media } from "@/content/media";
import { getService, services, type Service } from "@/content/services";
import { pageMetadata } from "@/content/seo";
import { bookingTerms, routes, site } from "@/content/site";

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return {};

  return pageMetadata({
    title: service.seo.title,
    description: service.seo.description,
    path: `/chauffeur-services/${service.slug}`,
  });
}

function OtherServices({ current }: { current: Service }) {
  const others = services.filter((s) => s.slug !== current.slug).slice(0, 4);
  return (
    <Section tone="dark">
      <SectionHead label="Other chauffeur services" note="All chauffeur-led" />
      <IndexRows
        columns={2}
        rows={others.map((service) => ({
          title: service.label,
          copy: service.summary,
          index: service.index,
          href: routes.service(service.slug),
        }))}
      />
      <div className="mt-12">
        <QuietLink href={routes.services}>View all chauffeur services</QuietLink>
      </div>
    </Section>
  );
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const quoteHref = routes.quoteFor(service.slug);

  // Service and breadcrumb schema, both mirroring what the page shows.
  const pageUrl = `${site.url}/chauffeur-services/${service.slug}`;
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: service.label,
      serviceType: `${service.label} chauffeur service`,
      description: service.seo.description,
      url: pageUrl,
      provider: { "@id": `${site.url}/#business` },
      areaServed: ["London", "United Kingdom", "Europe"],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site.url },
        { "@type": "ListItem", position: 2, name: "Chauffeur services", item: `${site.url}/chauffeur-services` },
        { "@type": "ListItem", position: 3, name: service.label, item: pageUrl },
      ],
    },
  ];
  const jsonLd = (
    <script
      type="application/ld+json"
      // Static, author-controlled content — no user input reaches this string.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );

  const hero = (
    <PageHero
      crumbs={[
        { label: "Chauffeur services", href: routes.services },
        { label: service.label },
      ]}
      display={service.display}
      standfirst={service.standfirst}
      image={media[service.hero]}
      imageAlt={service.heroAlt}
      facts={service.facts}
      actions={
        <>
          <GhostLink href={quoteHref}>Request a quote</GhostLink>
          <QuietLink href={routes.fleet}>See the fleet</QuietLink>
        </>
      }
    />
  );

  const included = service.included.map((item, i) => ({
    title: item.title,
    copy: item.copy,
    index: String(i + 1).padStart(2, "0"),
  }));

  const detailSplit = (tone: "dark" | "light", flip: boolean) => (
    <EditorialSplit
      tone={tone}
      flip={flip}
      image={media[service.detail.image]}
      imageAlt={service.detail.imageAlt}
      eyebrow={service.label}
      heading={service.detail.heading}
      paragraphs={service.detail.paragraphs}
      action={
        <GhostLink href={quoteHref} tone={tone}>
          Request a quote
        </GhostLink>
      }
    />
  );

  const brief = (
    <Section tone="dark" className="pt-16 lg:pt-24">
      <QuoteBrief
        needs={service.booking.needs}
        note={service.booking.note}
        terms={bookingTerms}
        quoteHref={quoteHref}
      />
    </Section>
  );

  const closing = (
    <EnquiryBand
      heading={service.closing}
      body="Send the details however suits you — most of our clients simply message us — and we will confirm availability and cost."
      tone="dark"
      primaryHref={quoteHref}
    />
  );

  if (service.template === "index") {
    return (
      <>
        {hero}
        {jsonLd}
        <Section tone="dark" className="pt-16 lg:pt-24">
          <Statement
            heading={["What the", "service", "involves"]}
            body={service.summary}
          />
          <IndexRows rows={included} />
        </Section>
        <StatementBand
          image={media[service.detail.image]}
          imageAlt={service.detail.imageAlt}
          eyebrow={service.detail.heading}
          quote={service.detail.paragraphs[0]}
        />
        <Section tone="dark" className="pt-16 lg:pt-24">
          <VehicleStrip ids={service.vehicles} tone="dark" />
        </Section>
        {brief}
        <OtherServices current={service} />
        {closing}
      </>
    );
  }

  if (service.template === "columns") {
    return (
      <>
        {hero}
        {jsonLd}
        <Section tone="dark" className="pt-16 lg:pt-24">
          <Statement
            tone="dark"
            heading={["What is", "included"]}
            body={service.summary}
          />
          <IndexRows rows={included} tone="dark" columns={2} />
        </Section>
        <Section tone="dark" className="pt-20 lg:pt-28">
          {detailSplit("dark", false)}
        </Section>
        <Section tone="dark">
          <VehicleStrip ids={service.vehicles} />
        </Section>
        {brief}
        <OtherServices current={service} />
        {closing}
      </>
    );
  }

  return (
    <>
      {hero}
      {jsonLd}
      <Section tone="dark" className="pt-20 lg:pt-28">
        {detailSplit("dark", true)}
      </Section>
      <Section tone="dark" className="pt-16 lg:pt-24">
        <Statement
          tone="dark"
          heading={["How it", "is arranged"]}
          body={service.summary}
        />
        <IndexRows rows={included} tone="dark" />
      </Section>
      <Section tone="dark">
        <VehicleStrip ids={service.vehicles} tone="dark" />
      </Section>
      {brief}
      <OtherServices current={service} />
      {closing}
    </>
  );
}
