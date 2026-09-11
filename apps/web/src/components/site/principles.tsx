import Image from "next/image";

import { media } from "@/content/media";
import { principles } from "@/content/site";
import { SectionLabel, shell } from "./primitives";
import { Reveal } from "./reveal";

const numerals = ["I", "II", "III"];

/**
 * The three principles, set as one editorial row beneath a single cabin
 * photograph. How each principle works in practice is expanded on /about.
 */
export function Principles({ index }: { index: string }) {
  return (
    <section className="bg-ink text-white">
      {/* Full-bleed cabin photography as the opening statement */}
      <Reveal variant="image">
        <div className="relative h-[48svh] min-h-80 w-full overflow-hidden lg:h-[60svh]">
          <Image
            src={media.principlesCabin}
            alt="The rear cabin of a Rolls-Royce Cullinan"
            fill
            quality={85}
            sizes="100vw"
            placeholder="blur"
            className="object-cover object-[60%_center]"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(0deg,rgba(11,11,12,0.92)_0%,rgba(11,11,12,0.25)_50%,rgba(11,11,12,0.35)_100%)]"
          />
          <div className={`${shell} absolute inset-x-0 bottom-0 pb-10 sm:pb-12`}>
            <Reveal delay={200}>
              <p className="label-xs text-silver">The way we work</p>
              <p className="quote-lg mt-5 max-w-[24ch] text-white">
                The car is quiet. So is everything else about the service.
              </p>
            </Reveal>
          </div>
        </div>
      </Reveal>

      <div className={`${shell} pt-14 pb-20 lg:pt-20 lg:pb-28`}>
        <div className="flex flex-wrap items-baseline justify-between gap-4 pb-10 lg:pb-14">
          <SectionLabel index={index}>Three principles</SectionLabel>
          <p className="label-xs text-white/55">Held on every journey</p>
        </div>

        <div className="grid grid-cols-1 gap-x-12 md:grid-cols-3">
          {principles.map((principle, i) => (
            <Reveal
              key={principle.title}
              delay={i * 90}
              className="border-t border-hairline py-8 md:py-10"
            >
              <p className="label-xs text-silver">{numerals[i]}</p>
              <h3 className="display-md mt-5 text-white">{principle.title}</h3>
              <p className="copy mt-5 max-w-[40ch] text-white/65">{principle.copy}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
