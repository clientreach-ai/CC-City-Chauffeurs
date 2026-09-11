import Image from "next/image";

import { supercarIds, vehicles } from "@/content/fleet";
import { media } from "@/content/media";
import { routes } from "@/content/site";
import { GhostLink, QuietLink, Rule, SectionLabel, shell } from "./primitives";
import { Reveal } from "./reveal";

/**
 * Deliberately the quietest section on the page. Self-drive matters to the
 * brand, but the site should read as a chauffeur company first — so this runs
 * at a smaller typographic scale than the chauffeur sections above it.
 */
export function SelfDrive() {
  return (
    <section id="self-drive" className="bg-mist text-ink">
      <div className={shell}>
        <Rule tone="light" />

        <div className="flex flex-wrap items-baseline justify-between gap-4 py-6">
          <SectionLabel index="07" tone="light">
            Supercars
          </SectionLabel>
          <p className="label-xs text-slate">Chauffeur-driven or self-drive</p>
        </div>

        <div className="grid grid-cols-1 items-center gap-10 pb-24 lg:grid-cols-12 lg:gap-16 lg:pb-36">
          <Reveal variant="image" className="lg:col-span-6">
            <div className="relative aspect-16/10 w-full overflow-hidden bg-ink">
              <Image
                src={media.selfDrive}
                alt="A supercar photographed outside a London hotel at night"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                placeholder="blur"
                className="object-cover"
              />
            </div>
          </Reveal>

          <div className="lg:col-span-5 lg:col-start-8">
            <Reveal delay={80}>
              <h2 className="display-lg max-w-[12ch] text-ink">Or take the wheel</h2>
            </Reveal>

            <Reveal delay={140}>
              <p className="copy mt-6 max-w-[46ch] text-slate">
                Selected supercars from the fleet are available to hire without a
                chauffeur, subject to driver eligibility and insurance requirements.
                Prefer to be driven? The same cars can be arranged chauffeur-driven
                for experiences, arrivals and pre-arranged journeys.
              </p>
            </Reveal>

            <Reveal delay={200} className="mt-8">
              <Rule tone="light" />
              {supercarIds.map((id) => (
                <div
                  key={id}
                  className="label-xs flex items-baseline justify-between gap-4 border-b border-hairline-ink py-4 text-slate"
                >
                  <span>{vehicles[id].name}</span>
                  <span className="text-ink">{vehicles[id].availability}</span>
                </div>
              ))}
            </Reveal>

            <Reveal delay={260} className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
              <GhostLink href={routes.supercarHire} tone="light">
                Supercar hire
              </GhostLink>
              <QuietLink href={routes.supercarExperiences} tone="light">
                Or be driven in one
              </QuietLink>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
