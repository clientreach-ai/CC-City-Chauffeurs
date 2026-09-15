import Image from "next/image";

import type { OccasionsSection } from "@CC-City-Chauffeurs/core";
import { GhostLink, QuietLink, SectionLabel, shell } from "@CC-City-Chauffeurs/ui/site/primitives";
import { Reveal } from "@CC-City-Chauffeurs/ui/site/reveal";

/**
 * Two occasions side by side — which two, and what they say, is set in the
 * admin. Both are summaries; the full account of each is on its service page.
 */
export function Occasions({ index, section }: { index: string; section: OccasionsSection }) {
  return (
    <section className="bg-obsidian text-white">
      <div className={`${shell} pb-20 lg:pb-28`}>
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-t border-hairline py-6">
          <SectionLabel index={index}>{section.label}</SectionLabel>
          <p className="label-xs text-white/55">{section.note}</p>
        </div>

        <div className="grid grid-cols-1 gap-16 pt-6 lg:grid-cols-2 lg:gap-12 lg:pt-10">
          {section.panels.map((panel, i) => (
            <article key={panel.id} id={panel.id} data-anchor>
              {panel.image ? (
                <Reveal variant="image" delay={i * 100}>
                  <div className="media-zoom relative aspect-4/3 w-full bg-graphite lg:aspect-5/4">
                    <Image
                      src={panel.image.src}
                      alt={panel.image.alt}
                      fill
                      sizes="(max-width: 1024px) 100vw, 48vw"
                      className="object-cover"
                    />
                  </div>
                </Reveal>
              ) : null}

              <Reveal delay={i * 100 + 80} className="mt-7">
                <p className="label-xs text-white/55">{panel.eyebrow}</p>
                <h2 className="display-lg mt-4 max-w-[14ch] text-white">{panel.heading}</h2>
                <p className="copy mt-5 max-w-[48ch] text-white/65">{panel.copy}</p>
                <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
                  {panel.primaryCta.label ? (
                    <GhostLink href={panel.primaryCta.href}>{panel.primaryCta.label}</GhostLink>
                  ) : null}
                  {panel.secondaryCta.label ? (
                    <QuietLink href={panel.secondaryCta.href}>{panel.secondaryCta.label}</QuietLink>
                  ) : null}
                </div>
              </Reveal>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
