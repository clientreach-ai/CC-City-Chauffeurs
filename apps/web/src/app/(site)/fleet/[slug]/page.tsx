import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  availabilityOptions,
  labelFor,
  passengersText,
  rateLabel,
  UNCONFIRMED,
  type Vehicle,
} from "@CC-City-Chauffeurs/core";
import { GhostLink, QuietLink, SectionHead, shell, Unbroken } from "@CC-City-Chauffeurs/ui/site/primitives";
import { VehiclePlate } from "@CC-City-Chauffeurs/ui/site/vehicle-plate";
import { GalleryGrid } from "@/components/site/gallery-grid";
import { EnquiryBand, Section, VehicleStrip } from "@/components/site/sections";
import { routes } from "@/content/site";
import { jsonLd } from "@/lib/json-ld";
import { absoluteUrl, pageMetadata, siteUrlOf } from "@/lib/metadata";
import { getFleet, getGallery, getServices, getSite } from "@/lib/site-data";
import { indexable } from "@/lib/vehicles";

/**
 * One vehicle: what it is, what it carries, what it costs, what comes in it
 * and what it is booked for — the page a search for "Rolls-Royce Cullinan
 * chauffeur London" should land on (PRD §9, §10.7).
 *
 * Every published vehicle has one, so the fleet page can always link to it.
 * Only a vehicle with a photograph is offered to search engines, though: a
 * page with no picture and one line of copy is the thin page the PRD warns
 * against (§10.13). Adding a photograph in the admin is what makes it
 * indexable — nothing here has to change.
 */

/** Published every minute from the admin's own records. */
export const revalidate = 60;

export async function generateStaticParams() {
  const fleet = await getFleet();
  return (fleet?.vehicles ?? []).map((vehicle) => ({ slug: vehicle.slug }));
}

async function findVehicle(slug: string) {
  const fleet = await getFleet();
  const vehicle = fleet?.vehicles.find((item) => item.slug === slug);
  return vehicle && fleet ? { vehicle, fleet } : null;
}

/**
 * The meta description: the editors' own if they wrote one, otherwise the
 * vehicle's line, its rate and where it drives — as many whole sentences as
 * fit in the 160 characters a search result shows.
 */
function describe(vehicle: Vehicle) {
  if (vehicle.seo.description) return vehicle.seo.description;
  const sentences = [
    vehicle.shortDescription,
    vehicle.pricing.hourlyRate != null ? `${rateLabel(vehicle)}.` : "",
    "Available across London, the UK and Europe.",
  ].filter(Boolean);
  let text = sentences[0] ?? vehicle.name;
  for (const sentence of sentences.slice(1)) {
    if (`${text} ${sentence}`.length > 160) break;
    text = `${text} ${sentence}`;
  }
  return text;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await findVehicle(slug);
  if (!found) return {};
  const { vehicle } = found;

  const metadata = await pageMetadata({
    title: vehicle.seo.title || `${vehicle.name} Chauffeur Hire, London | CC City Chauffeurs`,
    description: describe(vehicle),
    path: routes.vehicle(vehicle.slug),
  });
  const photo = vehicle.seo.shareImage ?? vehicle.images.main;
  return {
    ...metadata,
    ...(photo
      ? {
          openGraph: { ...metadata.openGraph, images: [{ url: photo.src, width: photo.width, height: photo.height, alt: photo.alt || vehicle.name }] },
          twitter: { ...metadata.twitter, images: [photo.src] },
        }
      : {}),
    ...(indexable(vehicle) ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function VehiclePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [found, gallery, site, published] = await Promise.all([
    findVehicle(slug),
    getGallery(),
    getSite(),
    getServices(),
  ]);
  if (!found) notFound();
  const { vehicle, fleet } = found;

  const enquireHref = `${routes.request}?vehicle=${encodeURIComponent(vehicle.name)}`;
  const main = vehicle.images.main;
  const inclusions = fleet.features.filter((feature) => vehicle.featureIds.includes(feature.id));
  const services = (published ?? []).filter((service) => vehicle.serviceIds.includes(service.id));
  const paragraphs = vehicle.description.split(/\n{2,}/).map((text) => text.trim()).filter(Boolean);

  // Its own photographs, then every gallery frame tagged with this vehicle.
  const photos = [
    ...vehicle.images.gallery.map((image) => ({ ...image, place: "" })),
    ...(gallery?.items ?? [])
      .filter((item) => item.vehicleId === vehicle.id)
      .map((item) => ({ ...item.image, place: item.location })),
  ].filter((image, i, all) => image.src && image.src !== main?.src && all.findIndex((other) => other.src === image.src) === i);

  // Others in the same groupings first, then the rest, photographed ones first.
  const others = fleet.vehicles
    .filter((other) => other.id !== vehicle.id)
    .sort(
      (a, b) =>
        Number(b.categoryIds.some((id) => vehicle.categoryIds.includes(id))) -
          Number(a.categoryIds.some((id) => vehicle.categoryIds.includes(id))) ||
        Number(Boolean(b.images.main)) - Number(Boolean(a.images.main)),
    )
    .slice(0, 4);

  const siteUrl = siteUrlOf(site?.settings.seo);
  const pageUrl = `${siteUrl}${routes.vehicle(vehicle.slug)}`;
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Car",
      name: vehicle.name,
      brand: { "@type": "Brand", name: vehicle.make },
      model: vehicle.model,
      description: describe(vehicle),
      url: pageUrl,
      ...(main ? { image: absoluteUrl(main.src, siteUrl) } : {}),
      ...(vehicle.specs.passengers != null ? { vehicleSeatingCapacity: vehicle.specs.passengers } : {}),
      ...(vehicle.pricing.hourlyRate != null
        ? {
            offers: {
              "@type": "Offer",
              url: pageUrl,
              priceCurrency: "GBP",
              availability: "https://schema.org/InStock",
              seller: { "@id": `${siteUrl}/#business` },
              priceSpecification: {
                "@type": "UnitPriceSpecification",
                price: vehicle.pricing.hourlyRate,
                priceCurrency: "GBP",
                unitCode: "HUR",
                referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "HUR" },
              },
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Fleet", item: `${siteUrl}${routes.fleet}` },
        { "@type": "ListItem", position: 3, name: vehicle.name, item: pageUrl },
      ],
    },
  ];

  const specs = [
    { label: "Passengers", value: passengersText(vehicle) },
    { label: "Luggage", value: vehicle.specs.luggage || UNCONFIRMED },
    { label: "Availability", value: labelFor(availabilityOptions, vehicle.availability) },
    { label: "Indicative rate", value: rateLabel(vehicle) },
    ...(vehicle.pricing.dayRate != null ? [{ label: "Day rate", value: `From £${vehicle.pricing.dayRate}` }] : []),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        // Escaped so a CMS value can never close this tag — see lib/json-ld.
        dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
      />

      <section className="bg-ink text-white">
        <div className={`${shell} pt-32 pb-20 lg:pt-40 lg:pb-28`}>
          <nav aria-label="Breadcrumb" className="label-xs flex flex-wrap gap-x-3 gap-y-1 text-white/60">
            <Link href={routes.fleet} className="link-quiet hover:text-white">
              Fleet
            </Link>
            <span aria-hidden>/</span>
            <span className="text-silver">{vehicle.name}</span>
          </nav>

          <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-7">
              <div className="relative aspect-4/3 w-full overflow-hidden bg-graphite">
                {main ? (
                  <Image
                    src={main.src}
                    alt={main.alt || vehicle.name}
                    fill
                    preload
                    quality={80}
                    sizes="(max-width: 1024px) 100vw, 58vw"
                    className="object-cover"
                  />
                ) : (
                  <VehiclePlate name={vehicle.name} marque={vehicle.make} />
                )}
              </div>
            </div>

            <div className="lg:col-span-5">
              <p className="label-xs text-white/60">{vehicle.make}</p>
              <h1 className="display-lg mt-4 text-white">
                <Unbroken text={vehicle.name} />
              </h1>
              <p className="copy-lg mt-6 max-w-[44ch] text-white/75">{vehicle.shortDescription}</p>

              <dl className="mt-8">
                {specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="flex items-baseline justify-between gap-6 border-b border-hairline py-3.5 first:border-t"
                  >
                    <dt className="label-xs text-white/60">{spec.label}</dt>
                    <dd className="label-xs text-white">{spec.value}</dd>
                  </div>
                ))}
              </dl>

              {vehicle.suitedTags.length ? (
                <p className="label-xs mt-6 flex flex-wrap gap-x-4 gap-y-2 text-white/60">
                  <span className="text-white/50">Suited to</span>
                  {vehicle.suitedTags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </p>
              ) : null}

              <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
                <GhostLink href={enquireHref}>Enquire about this vehicle</GhostLink>
                <QuietLink href={routes.fleet}>The whole fleet</QuietLink>
              </div>
              <p className="label-xs mt-6 max-w-[48ch] normal-case tracking-normal text-white/60">
                Rates are indicative; the price for your journey is confirmed with you before
                anything is booked.
              </p>
            </div>
          </div>
        </div>
      </section>

      {paragraphs.length || inclusions.length ? (
        <Section tone="dark">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16">
            {paragraphs.length ? (
              <div className="lg:col-span-7">
                <SectionHead label={`About the ${vehicle.model || vehicle.name}`} />
                {paragraphs.map((paragraph) => (
                  <p key={paragraph} className="copy mt-5 max-w-[62ch] text-white/75">
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : null}
            {inclusions.length ? (
              <div className={paragraphs.length ? "lg:col-span-4 lg:col-start-9" : "lg:col-span-12"}>
                <SectionHead label="Standard in the car" note="At no extra charge" />
                <ul
                  className={`grid grid-cols-1 ${paragraphs.length ? "" : "sm:grid-cols-2 lg:grid-cols-4 sm:gap-x-10"}`}
                >
                  {inclusions.map((feature) => (
                    <li key={feature.id} className="label-sm border-b border-hairline py-4 text-white/85">
                      {feature.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {photos.length ? (
        <Section tone="dark">
          <GalleryGrid
            filters={false}
            rows={[{ id: vehicle.slug, label: `The ${vehicle.name}, photographed` }]}
            images={photos.map((photo) => ({
              src: photo.src,
              width: photo.width,
              height: photo.height,
              alt: photo.alt || vehicle.name,
              subject: vehicle.slug,
              place: photo.place,
            }))}
          />
        </Section>
      ) : null}

      {services.length ? (
        <Section tone="dark">
          <SectionHead label="Booked for" note="Chauffeur services" />
          <ul className="flex flex-wrap gap-x-8 gap-y-4">
            {services.map((service) => (
              <li key={service.slug}>
                <QuietLink href={routes.service(service.slug)}>{service.name}</QuietLink>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {others.length ? (
        <Section tone="dark">
          <VehicleStrip vehicles={others} label="Also in the fleet" />
        </Section>
      ) : null}

      <EnquiryBand
        heading={`Tell us the date, and we will confirm the ${vehicle.model || vehicle.name}.`}
        body="Availability and the price are confirmed with you before anything is booked."
        primaryHref={enquireHref}
        primaryLabel="Enquire about this vehicle"
      />
    </>
  );
}
