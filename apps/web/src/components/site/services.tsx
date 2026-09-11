import Image from "next/image";
import Link from "next/link";

import { media } from "@/content/media";
import { services } from "@/content/services";
import { routes } from "@/content/site";
import { GhostLink, Rule, SectionLabel, shell } from "./primitives";
import { Reveal } from "./reveal";

/** Supercar work sits at the end of the index, below the chauffeur services. */
const extraRows = [
  {
    index: "10",
    label: "Supercar Experiences",
    summary:
      "Statement vehicles from the fleet, chauffeur-driven for select, pre-arranged journeys and arrivals.",
    detail: ["Pre-arranged", "Chauffeur-driven"],
    href: routes.supercarExperiences,
  },
  {
    index: "11",
    label: "Supercar Hire",
    summary:
      "Selected supercars available to hire without a chauffeur, subject to driver eligibility and insurance requirements.",
    detail: ["Self drive", "Terms on enquiry"],
    href: routes.supercarHire,
  },
];

export function Services({ index }: { index: string }) {
  const rows = [
    ...services.map((service) => ({
      index: service.index,
      label: service.label,
      summary: service.summary,
      detail: service.facts.slice(0, 3).map((fact) => fact.value),
      href: routes.service(service.slug),
    })),
    ...extraRows,
  ];

  return (
    <section id="services" className="glow-pool bg-ink pb-24 text-white lg:pb-36">
      <div className={shell}>
        <Rule tone="dark" />

        <div className="flex flex-wrap items-baseline justify-between gap-4 py-6">
          <SectionLabel index={index} tone="dark">
            Services
          </SectionLabel>
          <p className="label-xs text-white/55">
            Chauffeur-led, from a single transfer to a week
          </p>
        </div>

        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16">
          {/* Sticky editorial column */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <Reveal>
                <h2 className="display-xl max-w-[10ch] text-white">
                  More than
                  <br />
                  a car
                </h2>
              </Reveal>

              <Reveal delay={100}>
                <p className="copy mt-8 max-w-[42ch] text-white/65">
                  Most of what we are asked for is not simply a vehicle. It is a
                  morning that runs to time, a client collected properly, a wedding
                  party where nothing is left to chance. The car is the visible part.
                </p>
              </Reveal>

              <Reveal variant="image" delay={160} className="mt-10 hidden lg:block">
                <div className="media-zoom glow-ring relative aspect-5/4 w-full overflow-hidden bg-graphite">
                  <Image
                    src={media.servicesFeature}
                    alt="Rolls-Royce Cullinan waiting outside The Peninsula in London"
                    fill
                    sizes="40vw"
                    placeholder="blur"
                    className="object-cover"
                  />
                </div>
              </Reveal>

              <Reveal delay={200} className="mt-10">
                <GhostLink href={routes.services} tone="dark">
                  All chauffeur services
                </GhostLink>
              </Reveal>

              {/* Corporate is a Phase 1 priority but the business has no
                  accounts yet, so it earns a featured tile here rather than a
                  full band promising machinery that does not exist. */}
              <Reveal delay={260} className="mt-12">
                <Link
                  href={routes.service("corporate")}
                  className="tile-lift glow-ring glow-edge group block bg-elevated p-7 sm:p-8"
                >
                  <p className="label-xs text-white/55">For business</p>
                  <h3 className="display-sm mt-4 text-white">
                    Corporate travel
                  </h3>
                  <p className="copy mt-3 max-w-[38ch] text-white/60">
                    Agreed rates, consolidated monthly invoicing and a named
                    contact — for bookers arranging travel on behalf of others.
                  </p>
                  <p className="label-xs mt-6 flex items-center gap-3 text-silver">
                    Open an account
                    <span
                      aria-hidden
                      className="transition-transform duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </p>
                </Link>
              </Reveal>
            </div>
          </div>

          {/* Service index */}
          <ul className="lg:col-span-7">
            {rows.map((row, i) => (
              <Reveal
                as="li"
                key={row.index}
                delay={Math.min(i * 40, 240)}
                className="group border-t border-hairline last:border-b"
              >
                <Link
                  href={row.href}
                  className="grid grid-cols-[2.5rem_1fr] items-start gap-x-5 py-7 sm:grid-cols-[3.5rem_1fr] sm:gap-x-8 sm:py-9"
                >
                  <span className="label-xs pt-2 text-white/50 transition-colors duration-500 group-hover:text-silver">
                    {row.index}
                  </span>

                  <div>
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="display-sm text-white transition-transform duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:translate-x-1.5">
                        {row.label}
                      </h3>
                      <span
                        aria-hidden
                        className="label-xs shrink-0 text-silver opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      >
                        View
                      </span>
                    </div>

                    <p className="copy mt-3 max-w-[58ch] text-white/60">{row.summary}</p>

                    <p className="label-xs mt-4 flex flex-wrap gap-x-4 gap-y-2 text-white/50">
                      {row.detail.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
