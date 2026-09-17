import { notFound } from "next/navigation";

import {
  passengersText,
  rateLabel,
  UNCONFIRMED,
  availabilityOptions,
  labelFor,
  type Vehicle,
} from "@CC-City-Chauffeurs/core";
import { PageHero } from "@CC-City-Chauffeurs/ui/site/page-hero";
import { GhostLink, QuietLink, Rule, SectionHead, SectionLabel, shell } from "@CC-City-Chauffeurs/ui/site/primitives";
import { VehicleEntry, type VehicleEntryData } from "@CC-City-Chauffeurs/ui/site/vehicle-entry";
import { EnquiryBand, Section, StatementBand } from "@/components/site/sections";
import { media } from "@/content/media";
import { routes } from "@/content/site";
import { pageMetadata } from "@/content/seo";
import { getFleet } from "@/lib/site-data";

export const metadata = pageMetadata({
  title: "The Fleet | Rolls-Royce, Bentley, Mercedes | CC City Chauffeurs",
  description:
    "The CC City Chauffeurs fleet — Rolls-Royce Cullinan and Ghost, Bentley Flying Spur and Bentayga, Mercedes S-Class, V-Class and G-Wagon, and Lamborghini.",
  path: "/fleet",
});

/** Published every minute from the admin's own records. */
export const revalidate = 60;

/** A fleet record as the shared entry component takes it. */
function entryData(vehicle: Vehicle): VehicleEntryData {
  return {
    name: vehicle.name,
    marque: vehicle.make,
    line: vehicle.shortDescription,
    image: vehicle.images.main
      ? {
          src: vehicle.images.main.src,
          width: vehicle.images.main.width,
          height: vehicle.images.main.height,
        }
      : undefined,
    imageAlt: vehicle.images.main?.alt,
    specs: [
      { label: "Passengers", value: passengersText(vehicle) },
      { label: "Luggage", value: vehicle.specs.luggage || UNCONFIRMED },
      { label: "Availability", value: labelFor(availabilityOptions, vehicle.availability) },
      { label: "Indicative rate", value: rateLabel(vehicle) },
    ],
    suited: vehicle.suitedTags,
    enquireHref: `${routes.request}?vehicle=${encodeURIComponent(vehicle.name)}`,
  };
}

const numeral = (i: number) => String(i + 1).padStart(2, "0");

export default async function FleetPage() {
  const fleet = await getFleet();
  if (!fleet) notFound();

  const { categories, vehicles } = fleet;
  const groupingCount = ["No", "One", "Two", "Three", "Four", "Five", "Six"][categories.length];

  return (
    <>
      <PageHero
        eyebrow="The fleet"
        display={["One fleet.", "One", "standard."]}
        standfirst="A carefully selected fleet designed for chauffeur-driven comfort, presence and discretion. Every vehicle is maintained to the highest standards and presented immaculately for each journey."
        image={media.fleetCullinan}
        imageAlt="Rolls-Royce Cullinan in black, photographed in the workshop"
        objectPosition="object-[center_40%]"
        actions={
          <>
            <GhostLink href={routes.request}>Check availability</GhostLink>
            <QuietLink href={routes.gallery}>See the gallery</QuietLink>
          </>
        }
        facts={[
          { label: "Groupings", value: groupingCount ?? String(categories.length) },
          { label: "Rates", value: "Indicative · Confirmed on enquiry" },
          { label: "Coverage", value: "London · UK · Europe" },
        ]}
      />

      {/* Category index — jump links into the page */}
      <section className="bg-ink text-white">
        <div className={`${shell} pt-14 lg:pt-20`}>
          <Rule />
          <nav
            aria-label="Fleet groupings"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          >
            {categories.map((category, i) => (
              <a
                key={category.id}
                href={`#${category.id}`}
                className="group border-b border-hairline py-6 lg:border-r lg:pr-8 lg:last:border-r-0 lg:not-first:pl-8"
              >
                <span className="label-xs text-silver">{numeral(i)}</span>
                <span className="display-sm mt-3 block text-white/85 transition-colors duration-500 group-hover:text-white">
                  {category.title}
                </span>
                <span className="label-xs mt-3 block text-white/50">
                  {category.vehicles.length} vehicles
                </span>
              </a>
            ))}
          </nav>
        </div>
      </section>

      {categories.map((category, categoryIndex) => (
        <section key={category.id} id={category.id} className="bg-ink text-white">
          <div className={`${shell} pt-16 pb-6 lg:pt-24`}>
            <div className="flex flex-wrap items-baseline justify-between gap-4 pb-10">
              <SectionLabel index={numeral(categoryIndex)}>{category.title}</SectionLabel>
              <p className="label-xs text-white/55">{category.summary}</p>
            </div>

            <div className="flex flex-col gap-14 lg:gap-20">
              {category.vehicles.map((vehicle, i) => (
                <VehicleEntry
                  key={`${category.id}-${vehicle.id}`}
                  vehicle={entryData(vehicle)}
                  wide={(categoryIndex + i) % 3 === 0}
                />
              ))}
            </div>
          </div>
        </section>
      ))}

      <StatementBand
        image={media.cullinanWorkshopRear}
        imageAlt="Rolls-Royce Cullinan photographed from the rear"
        eyebrow="Presentation"
        quote="Every vehicle is presented immaculately for each journey. That is not a service level — it is the minimum."
      />

      {/* Full specification index */}
      <Section tone="dark" className="pt-16 lg:pt-24">
        <SectionHead
          label="Specification index"
          note="Indicative rates · Capacity confirmed on enquiry"
          tone="dark"
        />
        <ul>
          {vehicles.map((vehicle) => (
            <li
              key={vehicle.id}
              className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-hairline py-5 last:border-b sm:grid-cols-12 sm:items-baseline"
            >
              <span className="label-sm text-white sm:col-span-4">{vehicle.name}</span>
              <span className="label-xs text-white/55 sm:col-span-2">
                {vehicle.specs.passengers != null
                  ? `${vehicle.specs.passengers} passengers`
                  : `Capacity ${UNCONFIRMED.toLowerCase()}`}
              </span>
              <span className="label-xs text-white/55 sm:col-span-2">
                {vehicle.specs.luggage || `Luggage ${UNCONFIRMED.toLowerCase()}`}
              </span>
              <span className="label-xs text-white/55 sm:col-span-2">
                {labelFor(availabilityOptions, vehicle.availability)}
              </span>
              <span className="label-xs text-white sm:col-span-2 sm:text-right">
                {rateLabel(vehicle)}
              </span>
            </li>
          ))}
        </ul>
        <p className="label-xs mt-8 max-w-[62ch] text-white/55">
          Rates are indicative and depend on date, duration and route. Where a
          capacity is shown it is our own figure for that vehicle; the rest are
          confirmed with you when you enquire, against the party and the luggage.
        </p>
      </Section>

      <EnquiryBand
        heading="Tell us the journey and we will put the right car against it."
        body="If you are not sure which vehicle suits the booking, say what the day looks like and we will suggest one."
      />
    </>
  );
}
