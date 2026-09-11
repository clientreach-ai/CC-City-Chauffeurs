import Image from "next/image";

import { media } from "@/content/media";
import { chauffeurStandards } from "@/content/site";
import { SectionLabel, shell } from "./primitives";
import { Reveal } from "./reveal";

const principles = [
  {
    title: "Professionalism",
    copy: "Every journey is conducted with the highest level of professionalism and attention to detail — from the standard of presentation to the route planned before you step outside.",
    list: chauffeurStandards,
  },
  {
    title: "Comfort",
    copy: "A rear-seat focused service, ensuring our clients travel in complete comfort. Vehicles are chosen for the quality of the seat you sit in, not the badge on the bonnet.",
    image: media.principlesDetail,
    imageAlt: "Illuminated Cullinan door sill",
  },
  {
    title: "Discretion",
    copy: "Absolute confidentiality for every client, every journey. Names, destinations and schedules stay between us.",
    image: media.principlesWheel,
    imageAlt: "Rolls-Royce cabin detail",
  },
];

export function Principles() {
  return (
    <section className="bg-obsidian text-white">
      {/* Full-bleed cabin photography as the opening statement */}
      <Reveal variant="image">
        <div className="relative h-[62svh] min-h-[380px] w-full overflow-hidden lg:h-[78svh]">
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
            className="absolute inset-0 bg-[linear-gradient(0deg,rgba(6,6,7,0.9)_0%,rgba(6,6,7,0.25)_45%,rgba(6,6,7,0.35)_100%)]"
          />
          <div className={`${shell} absolute inset-x-0 bottom-0 pb-10 sm:pb-14`}>
            <Reveal delay={200}>
              <p className="label-xs text-silver">The way we work</p>
              <p className="quote-lg mt-5 max-w-[24ch] text-white">
                The car is quiet. So is everything else about the service.
              </p>
            </Reveal>
          </div>
        </div>
      </Reveal>

      <div className={`${shell} pt-16 pb-24 lg:pt-24 lg:pb-36`}>
        <div className="flex flex-wrap items-baseline justify-between gap-4 pb-12 lg:pb-20">
          <SectionLabel index="04">Three principles</SectionLabel>
          <p className="label-xs text-white/40">Held on every journey</p>
        </div>

        {principles.map((principle, i) => (
          <Reveal
            key={principle.title}
            delay={i * 80}
            className="grid grid-cols-1 gap-8 border-t border-hairline py-12 lg:grid-cols-12 lg:gap-16 lg:py-20 last:border-b"
          >
            <h3 className="display-lg text-white lg:col-span-6">{principle.title}</h3>

            <div className="lg:col-span-5 lg:col-start-8">
              <p className="copy-lg max-w-[46ch] text-white/70">{principle.copy}</p>

              {principle.list ? (
                <ul className="mt-8">
                  {principle.list.map((item) => (
                    <li
                      key={item}
                      className="label-xs border-b border-hairline py-3.5 text-white/45 first:border-t"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}

              {principle.image ? (
                <div className="relative mt-8 aspect-[16/10] w-full overflow-hidden bg-ink">
                  <Image
                    src={principle.image}
                    alt={principle.imageAlt ?? ""}
                    fill
                    sizes="(max-width: 1024px) 100vw, 38vw"
                    placeholder="blur"
                    className="object-cover"
                  />
                </div>
              ) : null}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
