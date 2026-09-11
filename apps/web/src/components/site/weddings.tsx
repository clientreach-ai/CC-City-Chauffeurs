import Image from "next/image";

import { media } from "@/content/media";
import { routes } from "@/content/site";
import { GhostLink, SectionLabel, shell } from "./primitives";
import { Reveal } from "./reveal";

const weddingNotes = [
  { label: "Principal car", value: "Chosen from the core fleet" },
  { label: "The wider party", value: "Additional vehicles alongside" },
  { label: "Agreed in advance", value: "Timings, routes, presentation" },
];

export function Weddings() {
  return (
    <section id="weddings" className="relative isolate flex min-h-[92svh] flex-col justify-end bg-obsidian text-white">
      <div className="absolute inset-0">
        <Image
          src={media.weddings}
          alt="Rolls-Royce Cullinan waiting on a lit hotel forecourt"
          fill
          quality={85}
          sizes="100vw"
          placeholder="blur"
          className="object-cover object-[42%_center] sm:object-center"
        />
        <div aria-hidden className="absolute inset-0 bg-obsidian/45 sm:bg-obsidian/20" />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(0deg,rgba(6,6,7,0.94)_0%,rgba(6,6,7,0.7)_34%,rgba(6,6,7,0.3)_62%,rgba(6,6,7,0.5)_100%)]"
        />
      </div>

      <div className={`${shell} relative pt-32 pb-12 sm:pb-16`}>
        <Reveal>
          <SectionLabel index="06">Weddings & private events</SectionLabel>
        </Reveal>

        <Reveal delay={120}>
          <h2 className="display-xl mt-6 max-w-[16ch] text-white">
            A day that runs to the minute
          </h2>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-end lg:gap-16">
          <Reveal delay={200} className="lg:col-span-5">
            <p className="copy-lg max-w-[46ch] text-white/75">
              Weddings and private occasions make up the majority of our work. The
              principal car, additional vehicles for the wider party, and every timing
              agreed long before the morning itself — so the day is the only thing
              anyone has to think about.
            </p>
            <GhostLink href={routes.service("weddings")} className="mt-8">
              Wedding chauffeur service
            </GhostLink>
          </Reveal>

          <Reveal delay={280} className="lg:col-span-6 lg:col-start-7">
            <dl className="grid grid-cols-1 sm:grid-cols-3 sm:gap-x-8">
              {weddingNotes.map((note) => (
                <div key={note.label} className="border-t border-hairline-strong py-4">
                  <dt className="label-xs text-white/40">{note.label}</dt>
                  <dd className="label-xs mt-2 text-white/85">{note.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
