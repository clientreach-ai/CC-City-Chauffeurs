import Image from "next/image";

import { fleetCategories, getVehicle, homepageVehicles, vehicles } from "@/content/fleet";
import { routes } from "@/content/site";
import { GhostLink, Rule, SectionHead, SectionLabel, shell } from "./primitives";
import { Reveal } from "./reveal";

const marqueeNames = Array.from(
  new Set(fleetCategories.flatMap((c) => c.vehicles.map((id) => vehicles[id].name))),
);

/** The one piece of continuous motion on the page — slow, and factual. */
function FleetMarquee() {
  const sequence = [...marqueeNames, ...marqueeNames];
  return (
    <div className="overflow-hidden border-y border-hairline py-7 sm:py-9">
      <div className="marquee-track flex w-max items-center">
        {sequence.map((name, i) => (
          <span key={`${name}-${i}`} className="flex items-center">
            <span className="display-sm px-8 whitespace-nowrap text-white/35">{name}</span>
            <span aria-hidden className="h-1 w-1 bg-silver/50" />
          </span>
        ))}
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-hairline py-3.5">
      <span className="label-xs text-white/40">{label}</span>
      <span className="label-xs text-white">{value}</span>
    </div>
  );
}

export function Fleet() {
  const [leadId, ...supportIds] = homepageVehicles;
  const lead = getVehicle(leadId);
  const support = supportIds.map(getVehicle);

  return (
    <section id="fleet" className="bg-ink text-white">
      <FleetMarquee />

      <div className={`${shell} pt-16 pb-24 lg:pt-24 lg:pb-36`}>
        <div className="flex flex-wrap items-baseline justify-between gap-4 pb-10">
          <SectionLabel index="03">The Fleet</SectionLabel>
          <p className="label-xs text-white/40">Four groupings · Chauffeur-led</p>
        </div>

        <div className="grid grid-cols-1 gap-8 pb-16 lg:grid-cols-12 lg:items-end lg:pb-24">
          <Reveal className="lg:col-span-7">
            <h2 className="display-xl text-white">
              One fleet.
              <br />
              One standard.
            </h2>
          </Reveal>
          <Reveal delay={120} className="lg:col-span-4 lg:col-start-9">
            <p className="copy max-w-[42ch] text-white/60">
              A carefully selected fleet designed for chauffeur-driven comfort,
              presence and discretion. Every vehicle is maintained to the highest
              standards and presented immaculately for each journey.
            </p>
          </Reveal>
        </div>

        {/* Featured vehicle — treated as an editorial product, not a card */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
          <Reveal variant="image" className="lg:col-span-8">
            <div className="relative aspect-4/3 w-full overflow-hidden bg-obsidian sm:aspect-16/10">
              {lead.image ? (
                <Image
                  src={lead.image}
                  alt={lead.imageAlt ?? lead.name}
                  fill
                  quality={85}
                  sizes="(max-width: 1024px) 100vw, 66vw"
                  placeholder="blur"
                  className="object-cover transition-transform duration-[1600ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:scale-[1.02]"
                />
              ) : null}
            </div>
          </Reveal>

          <div className="lg:col-span-4">
            <Reveal delay={80}>
              <p className="label-xs text-white/40">{lead.marque}</p>
              <h3 className="display-md mt-4 text-white">{lead.name}</h3>
              <p className="copy mt-5 max-w-[40ch] text-white/60">{lead.line}</p>
            </Reveal>

            <Reveal delay={140} className="mt-8">
              <Rule />
              <SpecRow label="Passengers" value={lead.passengers} />
              <SpecRow label="Luggage" value={lead.luggage} />
              <SpecRow label="Availability" value={lead.availability} />
              <SpecRow label="Indicative" value={lead.rate} />
            </Reveal>

            <Reveal delay={200} className="mt-8">
              <ul className="flex flex-col gap-2.5">
                {lead.suited.map((item) => (
                  <li key={item} className="copy flex gap-3 text-white/55">
                    <span aria-hidden className="mt-2.5 h-px w-3 shrink-0 bg-silver/60" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>

        {/* Two supporting vehicles */}
        <div className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-2 lg:mt-24 lg:gap-16">
          {support.map((vehicle, i) => (
            <div key={vehicle.id}>
              <Reveal variant="image" delay={i * 100}>
                <div className="relative aspect-4/3 w-full overflow-hidden bg-obsidian">
                  {vehicle.image ? (
                    <Image
                      src={vehicle.image}
                      alt={vehicle.imageAlt ?? vehicle.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 45vw"
                      placeholder="blur"
                      className="object-cover transition-transform duration-[1600ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:scale-[1.02]"
                    />
                  ) : null}
                </div>
              </Reveal>
              <Reveal delay={i * 100 + 80}>
                <p className="label-xs mt-6 text-white/40">{vehicle.marque}</p>
                <h3 className="display-sm mt-3 text-white">{vehicle.name}</h3>
                <p className="copy mt-4 max-w-[44ch] text-white/60">{vehicle.line}</p>
                <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2">
                  <span className="label-xs text-white/70">
                    <span className="text-white/35">Passengers </span>
                    {vehicle.passengers}
                  </span>
                  <span className="label-xs text-white/70">
                    <span className="text-white/35">Indicative </span>
                    {vehicle.rate}
                  </span>
                </div>
              </Reveal>
            </div>
          ))}
        </div>

        {/* The four groupings, as an index rather than a card grid */}
        <div className="mt-24 lg:mt-36">
          <SectionHead label="The four groupings" note="Indicative rates · Confirmed on enquiry" />

          {fleetCategories.map((category, i) => (
            <Reveal key={category.id} delay={Math.min(i * 60, 180)} className="mt-10 first:mt-0">
              <div className="border-t border-hairline-strong pt-6">
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  <span className="label-xs w-8 text-silver">{category.index}</span>
                  <h3 className="display-sm text-white">{category.title}</h3>
                  <p className="copy text-white/45">{category.summary}</p>
                </div>

                <ul className="mt-6">
                  {category.vehicles.map((id) => {
                    const vehicle = vehicles[id];
                    return (
                      <li
                        key={`${category.id}-${id}`}
                        className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-hairline py-4 sm:grid-cols-12 sm:items-baseline"
                      >
                        <span className="label-sm text-white sm:col-span-4">{vehicle.name}</span>
                        <span className="label-xs text-white/45 sm:col-span-2">
                          {vehicle.passengers} passengers
                        </span>
                        <span className="label-xs text-white/45 sm:col-span-2">
                          {vehicle.luggage}
                        </span>
                        <span className="label-xs text-white/45 sm:col-span-2">
                          {vehicle.availability}
                        </span>
                        <span className="label-xs text-white/80 sm:col-span-2 sm:text-right">
                          {vehicle.rate}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Reveal>
          ))}

          <Reveal className="mt-14 flex flex-wrap items-center gap-x-10 gap-y-5">
            <GhostLink href={routes.fleet}>View the full fleet</GhostLink>
            <p className="label-xs max-w-[46ch] text-white/40">
              Rates are indicative and depend on date, duration and route. Send us the
              journey and we will come back with a price.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
