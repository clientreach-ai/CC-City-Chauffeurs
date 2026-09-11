import Link from "next/link";

import { services, type ServiceSlug } from "@/content/services";
import { routes } from "@/content/site";
import { GhostLink, QuietLink, Rule, SectionLabel, shell } from "./primitives";
import { Reveal } from "./reveal";

/**
 * The six services most visitors arrive for, one line each. The full account
 * of every service — what is included, how it is booked, which vehicles
 * suit it — is on its own page.
 */
const featured: readonly ServiceSlug[] = [
  "private-chauffeur",
  "airport-transfers",
  "corporate",
  "weddings",
  "events",
  "city-to-city",
];

export function Services({ index }: { index: string }) {
  const lead = featured
    .map((slug) => services.find((service) => service.slug === slug))
    .filter((service) => service !== undefined);
  const more = services.filter((service) => !featured.includes(service.slug));

  return (
    <section id="services" className="bg-ink text-white">
      <div className={`${shell} pb-20 lg:pb-28`}>
        <Rule tone="dark" />

        <div className="flex flex-wrap items-baseline justify-between gap-4 py-6">
          <SectionLabel index={index} tone="dark">
            Services
          </SectionLabel>
          <p className="label-xs text-white/55">
            Chauffeur-led, from a single transfer to a week
          </p>
        </div>

        <div className="grid grid-cols-1 gap-12 pt-6 lg:grid-cols-12 lg:gap-16 lg:pt-10">
          <div className="lg:col-span-4">
            <Reveal>
              <h2 className="display-xl max-w-[10ch] text-white">
                More than
                <br />
                a car
              </h2>
            </Reveal>

            <Reveal delay={100}>
              <p className="copy mt-7 max-w-[38ch] text-white/65">
                A morning that runs to time, a client collected properly, a wedding
                party where nothing is left to chance. The car is the visible part.
              </p>
            </Reveal>

            <Reveal delay={160} className="mt-9">
              <GhostLink href={routes.services} tone="dark">
                All chauffeur services
              </GhostLink>
            </Reveal>
          </div>

          <div className="lg:col-span-8">
            <ul className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
              {lead.map((service, i) => (
                <Reveal
                  as="li"
                  key={service.slug}
                  delay={Math.min(i * 50, 250)}
                  className="group border-t border-hairline"
                >
                  <Link
                    href={routes.service(service.slug)}
                    className="flex h-full gap-5 py-6 sm:py-7"
                  >
                    <span className="label-xs pt-1.5 text-white/50 transition-colors duration-500 group-hover:text-silver">
                      {service.index}
                    </span>
                    <span className="block">
                      <span className="display-sm block text-white transition-transform duration-700 ease-editorial group-hover:translate-x-1">
                        {service.label}
                      </span>
                      <span className="copy mt-2 block max-w-[40ch] text-white/60">
                        {service.summary}
                      </span>
                    </span>
                  </Link>
                </Reveal>
              ))}
            </ul>

            <Reveal className="flex flex-wrap items-baseline gap-x-6 gap-y-3 border-t border-hairline pt-6">
              <span className="label-xs text-white/55">Also</span>
              {more.map((service) => (
                <QuietLink key={service.slug} href={routes.service(service.slug)}>
                  {service.label}
                </QuietLink>
              ))}
              <QuietLink href={routes.supercarExperiences}>Supercar experiences</QuietLink>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
