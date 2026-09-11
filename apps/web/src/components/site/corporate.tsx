import Image from "next/image";

import { media } from "@/content/media";
import { routes } from "@/content/site";
import { GhostLink, Rule, SectionLabel, shell } from "./primitives";
import { Reveal } from "./reveal";

const useCases = [
  "Executive and director travel",
  "Client transportation",
  "Meetings and site visits",
  "Roadshows and multi-day programmes",
  "Corporate events and hospitality",
  "Long-distance business travel",
];

export function Corporate() {
  return (
    <section id="corporate" className="bg-mist text-ink">
      <div className={shell}>
        <Rule tone="light" />

        <div className="flex flex-wrap items-baseline justify-between gap-4 py-6">
          <SectionLabel index="05" tone="light">
            Corporate
          </SectionLabel>
          <p className="label-xs text-slate">London · UK · Europe</p>
        </div>

        <div className="grid grid-cols-1 gap-12 pb-24 lg:grid-cols-12 lg:gap-16 lg:pb-36">
          <div className="lg:col-span-6">
            <Reveal>
              <h2 className="display-xl max-w-[14ch] text-ink">
                For people whose time is the asset
              </h2>
            </Reveal>

            <Reveal delay={100}>
              <p className="copy-lg mt-8 max-w-[48ch] text-ink/80">
                Executives, fund managers, visiting clients and the people who have to
                get them there. Schedules held to the minute, chauffeurs who know the
                city, and a vehicle that is already waiting when the meeting overruns.
              </p>
            </Reveal>

            <Reveal delay={160} className="mt-12">
              <Rule tone="light" />
              <ul className="grid grid-cols-1 sm:grid-cols-2">
                {useCases.map((item) => (
                  <li
                    key={item}
                    className="label-xs border-b border-hairline-ink py-4 text-slate"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={220} className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-5">
              <GhostLink href={routes.service("corporate")} tone="light">
                Corporate chauffeur service
              </GhostLink>
              <p className="label-xs max-w-[34ch] text-slate">
                Tell us the pattern of travel and we will put together the arrangement.
              </p>
            </Reveal>
          </div>

          <Reveal variant="image" delay={80} className="lg:col-span-5 lg:col-start-8">
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-ink">
              <Image
                src={media.corporate}
                alt="City Chauffeurs vehicles photographed against the Canary Wharf skyline at night"
                fill
                quality={85}
                sizes="(max-width: 1024px) 100vw, 40vw"
                placeholder="blur"
                className="object-cover object-[46%_center]"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
