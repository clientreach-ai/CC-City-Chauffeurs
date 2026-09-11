import Image, { type StaticImageData } from "next/image";

import { media } from "@/content/media";
import { routes } from "@/content/site";
import { GhostLink, QuietLink, SectionLabel, shell } from "./primitives";
import { Reveal } from "./reveal";

type Panel = {
  id: string;
  eyebrow: string;
  heading: string;
  copy: string;
  image: StaticImageData;
  imageAlt: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
};

/*
 * Weddings lead: they are the largest share of the work. Corporate sits
 * alongside as the line the business is growing. Both are summaries — the
 * full account of each is on its service page.
 */
const panels: readonly Panel[] = [
  {
    id: "weddings",
    eyebrow: "Weddings & private events",
    heading: "A day that runs to the minute",
    copy: "Weddings and private occasions make up the majority of our work. The principal car, vehicles for the wider party, and every timing agreed long before the morning itself.",
    image: media.weddings,
    imageAlt: "Rolls-Royce Cullinan waiting on a lit hotel forecourt",
    primary: { label: "Wedding chauffeur service", href: routes.service("weddings") },
    secondary: { label: "Private events", href: routes.service("events") },
  },
  {
    id: "corporate",
    eyebrow: "Corporate travel",
    heading: "For people whose time is the asset",
    copy: "Executive travel, client transportation, roadshows and multi-day programmes — schedules held to the minute across London's business districts, the UK and Europe.",
    image: media.cullinanCanaryWharf,
    imageAlt: "Rolls-Royce Cullinan at Canary Wharf at night",
    primary: { label: "Corporate chauffeur service", href: routes.service("corporate") },
    secondary: { label: "Roadshows", href: routes.service("roadshows") },
  },
];

export function Occasions({ index }: { index: string }) {
  return (
    <section className="bg-obsidian text-white">
      <div className={`${shell} pb-20 lg:pb-28`}>
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-t border-hairline py-6">
          <SectionLabel index={index}>Weddings & corporate</SectionLabel>
          <p className="label-xs text-white/55">London · UK · Europe</p>
        </div>

        <div className="grid grid-cols-1 gap-16 pt-6 lg:grid-cols-2 lg:gap-12 lg:pt-10">
          {panels.map((panel, i) => (
            <article key={panel.id} id={panel.id} data-anchor>
              <Reveal variant="image" delay={i * 100}>
                <div className="media-zoom relative aspect-4/3 w-full bg-graphite lg:aspect-5/4">
                  <Image
                    src={panel.image}
                    alt={panel.imageAlt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 48vw"
                    placeholder="blur"
                    className="object-cover"
                  />
                </div>
              </Reveal>

              <Reveal delay={i * 100 + 80} className="mt-7">
                <p className="label-xs text-white/55">{panel.eyebrow}</p>
                <h2 className="display-lg mt-4 max-w-[14ch] text-white">{panel.heading}</h2>
                <p className="copy mt-5 max-w-[48ch] text-white/65">{panel.copy}</p>
                <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
                  <GhostLink href={panel.primary.href}>{panel.primary.label}</GhostLink>
                  <QuietLink href={panel.secondary.href}>{panel.secondary.label}</QuietLink>
                </div>
              </Reveal>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
