import Image from "next/image";

import type { PrinciplesSection } from "@CC-City-Chauffeurs/core";
import { SectionLabel, shell } from "@CC-City-Chauffeurs/ui/site/primitives";
import { Reveal } from "@CC-City-Chauffeurs/ui/site/reveal";

const numerals = ["I", "II", "III", "IV", "V", "VI"];

/**
 * The principles, set as one editorial row beneath a single cabin
 * photograph. How each works in practice is expanded on /about.
 */
export function Principles({ index, section }: { index: string; section: PrinciplesSection }) {
  return (
    <section className="bg-ink text-white">
      {/* Full-bleed cabin photography as the opening statement */}
      {section.image ? (
        <Reveal variant="image">
          <div className="relative h-[48svh] min-h-80 w-full overflow-hidden lg:h-[60svh]">
            <Image
              src={section.image.src}
              alt={section.image.alt}
              fill
              quality={85}
              sizes="100vw"
              className="object-cover object-[60%_center]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(0deg,rgba(11,11,12,0.92)_0%,rgba(11,11,12,0.25)_50%,rgba(11,11,12,0.35)_100%)]"
            />
            <div className={`${shell} absolute inset-x-0 bottom-0 pb-10 sm:pb-12`}>
              <Reveal delay={200}>
                <p className="label-xs text-silver">{section.eyebrow}</p>
                <p className="quote-lg mt-5 max-w-[24ch] text-white">{section.quote}</p>
              </Reveal>
            </div>
          </div>
        </Reveal>
      ) : null}

      <div className={`${shell} pt-14 pb-20 lg:pt-20 lg:pb-28`}>
        <div className="flex flex-wrap items-baseline justify-between gap-4 pb-10 lg:pb-14">
          <SectionLabel index={index}>{section.name}</SectionLabel>
          <p className="label-xs text-white/55">Held on every journey</p>
        </div>

        <div className="grid grid-cols-1 gap-x-12 md:grid-cols-3">
          {section.items.map((item, i) => (
            <Reveal
              key={item.title}
              delay={i * 90}
              className="border-t border-hairline py-8 md:py-10"
            >
              <p className="label-xs text-silver">{numerals[i] ?? String(i + 1)}</p>
              <h3 className="display-md mt-5 text-white">{item.title}</h3>
              <p className="copy mt-5 max-w-[40ch] text-white/65">{item.copy}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
