import Link from "next/link";
import type { Route } from "next";

import type { FeaturedServicesSection, Service } from "@CC-City-Chauffeurs/core";
import { routes } from "@/content/site";
import { GhostLink, QuietLink, Rule, SectionLabel, shell } from "@CC-City-Chauffeurs/ui/site/primitives";
import { Reveal } from "@CC-City-Chauffeurs/ui/site/reveal";

/**
 * The services most visitors arrive for, one line each. Which ones are
 * featured, and in what order, is set in the admin; everything published but
 * not featured is listed underneath rather than dropped.
 */
export function Services({
  index,
  section,
  all,
}: {
  index: string;
  section: FeaturedServicesSection & { services?: Service[] };
  /** Every published service, so the "Also" line can name the rest. */
  all: { slug: string; name: string }[];
}) {
  const lead = section.services ?? [];
  const featured = new Set(lead.map((service) => service.slug));
  const more = all.filter((service) => !featured.has(service.slug));

  return (
    <section id="services" className="bg-ink text-white">
      <div className={`${shell} pb-20 lg:pb-28`}>
        <Rule tone="dark" />

        <div className="flex flex-wrap items-baseline justify-between gap-4 py-6">
          <SectionLabel index={index} tone="dark">
            {section.label}
          </SectionLabel>
          <p className="label-xs text-white/55">{section.note}</p>
        </div>

        <div className="grid grid-cols-1 gap-12 pt-6 lg:grid-cols-12 lg:gap-16 lg:pt-10">
          <div className="lg:col-span-4">
            <Reveal>
              <h2 className="display-xl max-w-[10ch] text-white">{section.heading}</h2>
            </Reveal>

            <Reveal delay={100}>
              <p className="copy mt-7 max-w-[38ch] text-white/65">{section.body}</p>
            </Reveal>

            {section.cta.label ? (
              <Reveal delay={160} className="mt-9">
                <GhostLink href={section.cta.href} tone="dark">
                  {section.cta.label}
                </GhostLink>
              </Reveal>
            ) : null}
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
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="block">
                      <span className="display-sm block text-white transition-transform duration-700 ease-editorial group-hover:translate-x-1">
                        {service.name}
                      </span>
                      <span className="copy mt-2 block max-w-[40ch] text-white/60">
                        {service.summary}
                      </span>
                    </span>
                  </Link>
                </Reveal>
              ))}
            </ul>

            {more.length ? (
              <Reveal className="flex flex-wrap items-baseline gap-x-6 gap-y-3 border-t border-hairline pt-6">
                <span className="label-xs text-white/55">Also</span>
                {more.map((service) => (
                  <QuietLink key={service.slug} href={routes.service(service.slug)}>
                    {service.name}
                  </QuietLink>
                ))}
                <QuietLink href={routes.supercarExperiences as Route}>
                  Supercar experiences
                </QuietLink>
              </Reveal>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
