import type { Metadata } from "next";
import Image from "next/image";

import { PageHero } from "@/components/site/page-hero";
import { GhostLink, QuietLink, Rule, SectionHead } from "@/components/site/primitives";
import { Reveal } from "@/components/site/reveal";
import {
  EditorialSplit,
  EnquiryBand,
  Section,
  Statement,
  StatementBand,
} from "@/components/site/sections";
import { media } from "@/content/media";
import {
  assurances,
  chauffeurStandards,
  principles,
  routes,
  serviceAreas,
  site,
} from "@/content/site";

export const metadata: Metadata = {
  title: "About | Luxury Chauffeur Company, London | CC City Chauffeurs",
  description:
    "CC City Chauffeurs is a London chauffeur company built on professionalism, comfort and discretion — a luxury, discreet way of travelling without the hassle.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        display={["A luxury,", "discreet way", "to travel"]}
        standfirst="City Chauffeurs is a London chauffeur company working for private clients, executives, wedding parties and corporate accounts across the United Kingdom and Europe."
        image={media.cullinanWorkshopSide}
        imageAlt="Rolls-Royce Cullinan photographed in profile at the workshop"
        objectPosition="object-[center_45%]"
        facts={[
          { label: "Based", value: site.base },
          { label: "Coverage", value: "United Kingdom and Europe" },
          { label: "Director", value: site.director },
        ]}
        actions={
          <>
            <GhostLink href={routes.quote}>Request a quote</GhostLink>
            <QuietLink href={routes.services}>Chauffeur services</QuietLink>
          </>
        }
      />

      <Section tone="dark" className="pt-16 lg:pt-24">
        <Statement
          tone="dark"
          heading={["Without", "the hassle"]}
          body="That phrase does most of the work. The point of a chauffeur is not the badge on the car — it is that the journey stops being something you have to think about."
        />

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal variant="image" className="lg:col-span-5">
            <div className="media-zoom glow-ring relative aspect-4/5 w-full overflow-hidden bg-graphite">
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
            <Reveal>
              <p className="copy-lg max-w-[54ch] text-white/80">
                City Chauffeurs provides discreet, professional chauffeur services
                for clients who expect the highest standards. Every journey is
                planned around comfort, timing and confidentiality — the three things
                people actually notice when they are missing.
              </p>
            </Reveal>

            <Reveal delay={100}>
              <p className="copy mt-6 max-w-[54ch] text-white/60">
                Based in London, we operate across the entire United Kingdom and into
                Europe. The fleet is selected for rear-seat comfort, presence and
                discretion, and every vehicle is presented immaculately for each
                journey. Supercars are available too — chauffeur-driven or self-drive
                — but the chauffeur is what the company is built around.
              </p>
            </Reveal>

            <Reveal delay={160}>
              <p className="copy mt-6 max-w-[54ch] text-white/60">
                We are not the cheapest way to get across London, and we are not
                trying to be. We are the version where somebody has already thought
                about the route, the timing and where the car can actually stop.
              </p>
            </Reveal>

            <Reveal delay={220} className="mt-10">
              <p className="label-xs text-white">{site.director}</p>
              <p className="label-xs mt-2 text-white/55">Director, {site.legalName}</p>
            </Reveal>
          </div>
        </div>
      </Section>

      <StatementBand
        image={media.cullinanRearCabin}
        imageAlt="The rear cabin of a Rolls-Royce Cullinan"
        eyebrow="Three principles"
        quote="Professionalism. Comfort. Discretion. Everything else is detail."
        objectPosition="object-[60%_center]"
      />

      <Section tone="dark" className="pt-16 lg:pt-24">
        <SectionHead label="What they mean in practice" note="Held on every journey" />
        {principles.map((principle, i) => (
          <Reveal
            key={principle.title}
            delay={i * 80}
            className="grid grid-cols-1 gap-8 border-t border-hairline py-12 last:border-b lg:grid-cols-12 lg:gap-16 lg:py-16"
          >
            <h3 className="display-lg text-white lg:col-span-6">{principle.title}</h3>
            <p className="copy-lg max-w-[46ch] text-white/70 lg:col-span-5 lg:col-start-8">
              {principle.copy}
            </p>
          </Reveal>
        ))}
      </Section>

      <Section tone="dark">
        <EditorialSplit
          image={media.cullinanFrontCabin}
          imageAlt="The front cabin of a Rolls-Royce Cullinan"
          eyebrow="Our chauffeurs"
          heading="Selected, trained and briefed"
          paragraphs={[
            "The chauffeur is the service. Ours are presented properly and briefed on the booking before they arrive — not handed an address on the morning.",
          ]}
          points={chauffeurStandards}
          aspect="aspect-4/3"
          flip
        />
      </Section>

      <Section tone="dark" className="pt-16 lg:pt-24">
        <SectionHead label="Practicalities" note="London based · UK & Europe" tone="dark" />
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6">
            <h3 className="display-md text-white">Where we work</h3>
            <p className="copy mt-5 max-w-[46ch] text-white/60">
              Most journeys start in central and west London, and go anywhere from
              there. Airport work covers Gatwick and all London airports, including
              private terminals on request.
            </p>
            <Rule tone="dark" className="mt-8" />
            <ul className="grid grid-cols-2">
              {serviceAreas.map((area) => (
                <li
                  key={area}
                  className="label-xs border-b border-hairline py-4 text-white/55"
                >
                  {area}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-5 lg:col-start-8">
            <h3 className="display-md text-white">What is included as standard</h3>
            <p className="copy mt-5 max-w-[44ch] text-white/60">
              These apply to every booking rather than being sold as extras.
            </p>
            <Rule tone="dark" className="mt-8" />
            <ul>
              {assurances.map((item) => (
                <li
                  key={item}
                  className="label-xs border-b border-hairline py-4 text-white/55"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <EnquiryBand
        heading="If it sounds like the right fit, tell us the journey."
        body="Enquiries are handled in confidence. Most of our clients simply message us."
      />
    </>
  );
}
