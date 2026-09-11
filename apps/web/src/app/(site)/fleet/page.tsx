import type { Metadata } from "next";
import Image from "next/image";

import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import {
  GhostLink,
  QuietLink,
  Rule,
  SectionHead,
  SectionLabel,
  shell,
} from "@/components/site/primitives";
import { EnquiryBand, Section, StatementBand, VehiclePlate } from "@/components/site/sections";
import { fleetCategories, vehicles, type Vehicle } from "@/content/fleet";
import { media } from "@/content/media";
import { routes } from "@/content/site";

export const metadata: Metadata = {
  title: "The Fleet | Rolls-Royce, Bentley, Mercedes | CC City Chauffeurs",
  description:
    "The CC City Chauffeurs fleet — chauffeur fleet, high-profile SUVs, group transport and statement vehicles. Rolls-Royce Cullinan and Ghost, Bentley Flying Spur and Bentayga, Mercedes S-Class, V-Class and G-Wagon, Range Rover Vogue and Lamborghini.",
  alternates: { canonical: "/fleet" },
};

function VehicleEntry({ vehicle, index }: { vehicle: Vehicle; index: number }) {
  const wide = index % 3 === 0;

  return (
    <Reveal
      className={`grid grid-cols-1 gap-8 border-t border-hairline pt-10 lg:grid-cols-12 lg:gap-16 ${
        wide ? "" : ""
      }`}
    >
      <div className={wide ? "lg:col-span-7" : "lg:col-span-5"}>
        <div className="media-zoom glow-ring relative aspect-4/3 w-full overflow-hidden bg-graphite">
          {vehicle.image ? (
            <Image
              src={vehicle.image}
              alt={vehicle.imageAlt ?? vehicle.name}
              fill
              quality={85}
              sizes="(max-width: 1024px) 100vw, 50vw"
              placeholder="blur"
              className="object-cover transition-transform duration-[1600ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:scale-[1.02]"
            />
          ) : (
            <VehiclePlate name={vehicle.name} marque={vehicle.marque} />
          )}
        </div>
      </div>

      <div className={wide ? "lg:col-span-4 lg:col-start-9" : "lg:col-span-6 lg:col-start-7"}>
        <p className="label-xs text-white/55">{vehicle.marque}</p>
        <h3 className="display-md mt-4 text-white">{vehicle.name}</h3>
        <p className="copy mt-5 max-w-[46ch] text-white/60">{vehicle.line}</p>

        <dl className="mt-8">
          {[
            { label: "Passengers", value: vehicle.passengers },
            { label: "Luggage", value: vehicle.luggage },
            { label: "Availability", value: vehicle.availability },
            { label: "Indicative rate", value: vehicle.rate },
          ].map((spec) => (
            <div
              key={spec.label}
              className="flex items-baseline justify-between gap-6 border-b border-hairline py-3.5 first:border-t"
            >
              <dt className="label-xs text-white/55">{spec.label}</dt>
              <dd className="label-xs text-white">{spec.value}</dd>
            </div>
          ))}
        </dl>

        <p className="label-xs mt-6 flex flex-wrap gap-x-4 gap-y-2 text-white/55">
          <span className="text-white/45">Suited to</span>
          {vehicle.suited.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </p>

        <div className="mt-8">
          <GhostLink href={routes.quote} className="!px-6 !py-3">
            Enquire about this vehicle
          </GhostLink>
        </div>
      </div>
    </Reveal>
  );
}

export default function FleetPage() {
  const uniqueVehicles = Array.from(
    new Set(fleetCategories.flatMap((category) => category.vehicles)),
  );

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
            <GhostLink href={routes.quote}>Check availability</GhostLink>
            <QuietLink href={routes.gallery}>See the gallery</QuietLink>
          </>
        }
        facts={[
          { label: "Groupings", value: "Four" },
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
            {fleetCategories.map((category) => (
              <a
                key={category.id}
                href={`#${category.id}`}
                className="group border-b border-hairline py-6 lg:border-r lg:pr-8 lg:last:border-r-0 lg:not-first:pl-8"
              >
                <span className="label-xs text-silver">{category.index}</span>
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

      {fleetCategories.map((category, categoryIndex) => (
        <section key={category.id} id={category.id} className="bg-ink text-white">
          <div className={`${shell} pt-16 pb-6 lg:pt-24`}>
            <div className="flex flex-wrap items-baseline justify-between gap-4 pb-10">
              <SectionLabel index={category.index}>{category.title}</SectionLabel>
              <p className="label-xs text-white/55">{category.summary}</p>
            </div>

            <div className="flex flex-col gap-14 lg:gap-20">
              {category.vehicles.map((id, i) => (
                <VehicleEntry
                  key={`${category.id}-${id}`}
                  vehicle={vehicles[id]}
                  index={categoryIndex + i}
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
          note="Standard configuration · Confirmed on enquiry"
          tone="dark"
        />
        <ul>
          {uniqueVehicles.map((id) => {
            const vehicle = vehicles[id];
            return (
              <li
                key={id}
                className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-hairline-ink py-5 last:border-b sm:grid-cols-12 sm:items-baseline"
              >
                <span className="label-sm text-ink sm:col-span-4">{vehicle.name}</span>
                <span className="label-xs text-slate sm:col-span-2">
                  {vehicle.passengers} passengers
                </span>
                <span className="label-xs text-slate sm:col-span-2">{vehicle.luggage}</span>
                <span className="label-xs text-slate sm:col-span-2">
                  {vehicle.availability}
                </span>
                <span className="label-xs text-ink sm:col-span-2 sm:text-right">
                  {vehicle.rate}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="label-xs mt-8 max-w-[62ch] text-slate">
          Rates are indicative and depend on date, duration and route. Passenger and
          luggage figures are the standard configuration for each model and are
          confirmed when a vehicle is booked.
        </p>
      </Section>

      <EnquiryBand
        heading="Tell us the journey and we will put the right car against it."
        body="If you are not sure which vehicle suits the booking, say what the day looks like and we will suggest one."
      />
    </>
  );
}
