import Image from "next/image";

import { media } from "@/content/media";
import { assurances, site } from "@/content/site";
import { Rule, SectionLabel, shell } from "./primitives";
import { Reveal } from "./reveal";

export function Statement() {
  return (
    <section id="chauffeur" className="bg-mist text-ink">
      <div className={shell}>
        <Rule tone="light" />

        <div className="flex flex-wrap items-baseline justify-between gap-4 py-6">
          <SectionLabel index="01" tone="light">
            A chauffeur company first
          </SectionLabel>
          <p className="label-xs text-slate">{site.coverage}</p>
        </div>

        <Reveal className="pb-16 sm:pb-24">
          <h2 className="display-lg max-w-[22ch] text-ink">
            A luxury, discreet way of travelling — without the hassle.
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-12 pb-24 lg:grid-cols-12 lg:gap-16 lg:pb-36">
          <Reveal variant="image" className="lg:col-span-5">
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-ink">
              <Image
                src={media.statement}
                alt="The Spirit of Ecstasy on the bonnet of a Rolls-Royce"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                placeholder="blur"
                className="object-cover object-[58%_center]"
              />
            </div>
          </Reveal>

          <div className="lg:col-span-6 lg:col-start-7 lg:pt-4">
            <Reveal delay={80}>
              <p className="copy-lg max-w-[54ch] text-ink/85">
                City Chauffeurs provides discreet, professional chauffeur services
                for clients who expect the highest standards — private clients,
                executives, wedding parties and corporate accounts. Every journey is
                planned around comfort, timing and confidentiality.
              </p>
            </Reveal>

            <Reveal delay={160}>
              <p className="copy mt-6 max-w-[54ch] text-slate">
                Based in London, we operate across the entire United Kingdom and into
                Europe. The fleet is selected for rear-seat comfort, presence and
                discretion, and every vehicle is presented immaculately for each
                journey. Supercars are available too — chauffeur-driven or self-drive
                — but the chauffeur is what we are built around.
              </p>
            </Reveal>

            <Reveal delay={220} className="mt-10">
              <p className="label-xs text-ink">{site.director}</p>
              <p className="label-xs mt-2 text-slate">Director, {site.legalName}</p>
            </Reveal>

            <Reveal delay={280} className="mt-12">
              <Rule tone="light" />
              <ul className="grid grid-cols-1 sm:grid-cols-2">
                {assurances.map((item) => (
                  <li
                    key={item}
                    className="label-xs border-b border-hairline-ink py-4 text-slate"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
