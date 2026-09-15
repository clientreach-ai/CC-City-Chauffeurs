import Image from "next/image";
import Link from "next/link";

import { rateLabel, type FeaturedFleetSection, type Vehicle } from "@CC-City-Chauffeurs/core";
import { routes } from "@/content/site";
import { GhostLink, QuietLink, SectionLabel, shell, Unbroken } from "@CC-City-Chauffeurs/ui/site/primitives";
import { Reveal } from "@CC-City-Chauffeurs/ui/site/reveal";

/** The one piece of continuous motion on the page — slow, and factual. */
function FleetMarquee({ names }: { names: string[] }) {
  if (!names.length) return null;
  const sequence = [...names, ...names];
  return (
    <div className="overflow-hidden border-y border-hairline py-7 sm:py-9" aria-hidden>
      <div className="marquee-track flex w-max items-center">
        {sequence.map((name, i) => (
          <span key={`${name}-${i}`} className="flex items-center">
            <span className="display-sm px-8 whitespace-nowrap text-white/50">{name}</span>
            <span className="h-1 w-1 bg-silver/50" />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * A showcase, not a catalogue: the vehicles the editors chose to feature, and
 * a way into the rest. Capacities, groupings and the full specification index
 * are on /fleet. The marquee names every published vehicle.
 */
export function Fleet({
  index,
  section,
  marquee,
}: {
  index: string;
  section: FeaturedFleetSection & { vehicles?: Vehicle[] };
  /** Every published vehicle's name, for the marquee. */
  marquee: string[];
}) {
  const shown = section.vehicles ?? [];

  return (
    <section id="fleet" className="bg-obsidian text-white">
      <FleetMarquee names={marquee} />

      <div className={`${shell} pt-14 pb-20 lg:pt-20 lg:pb-28`}>
        <div className="flex flex-wrap items-baseline justify-between gap-4 pb-10">
          <SectionLabel index={index}>{section.label}</SectionLabel>
          <p className="label-xs text-white/55">{section.note}</p>
        </div>

        <div className="grid grid-cols-1 gap-8 pb-12 lg:grid-cols-12 lg:items-end lg:pb-16">
          <Reveal className="lg:col-span-7">
            <h2 className="display-xl text-white">
              <Unbroken text={section.heading} />
            </h2>
          </Reveal>
          <Reveal
            delay={120}
            className="flex flex-col items-start gap-7 lg:col-span-4 lg:col-start-9"
          >
            <p className="copy max-w-[42ch] text-white/65">{section.body}</p>
            {section.cta.label ? (
              <GhostLink href={section.cta.href}>{section.cta.label}</GhostLink>
            ) : null}
          </Reveal>
        </div>

        <ul className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {shown.map((vehicle, i) => (
            <Reveal
              as="li"
              key={vehicle.id}
              delay={i * 90}
              className={i === 2 ? "sm:col-span-2 lg:col-span-1" : ""}
            >
              <Link href={routes.fleet} className="group block">
                <div className="media-zoom relative aspect-4/3 w-full bg-graphite">
                  {vehicle.images.main ? (
                    <Image
                      src={vehicle.images.main.src}
                      alt={vehicle.images.main.alt || vehicle.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 32vw"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="mt-5 border-t border-hairline pt-4">
                  <p className="label-xs flex items-baseline justify-between gap-4">
                    <span className="text-white/55">{vehicle.make}</span>
                    <span className="text-white/75">{rateLabel(vehicle)}</span>
                  </p>
                  <h3 className="display-sm mt-3 text-white">
                    <Unbroken text={vehicle.name} />
                  </h3>
                </div>
              </Link>
            </Reveal>
          ))}
        </ul>

        {/* Supercars are signposted here rather than given a band of their
            own — the homepage stays chauffeur-led. */}
        <Reveal className="mt-14 flex flex-wrap items-baseline justify-between gap-x-10 gap-y-4 border-t border-hairline pt-6">
          <p className="label-xs text-white/55">
            Supercars — chauffeur-driven or self-drive, by arrangement
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <QuietLink href={routes.supercarExperiences}>Supercar experiences</QuietLink>
            <QuietLink href={routes.supercarHire}>Self-drive hire</QuietLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
