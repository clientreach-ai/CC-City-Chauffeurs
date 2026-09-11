import type { Metadata } from "next";

import { PageHero } from "@/components/site/page-hero";
import { GhostLink, QuietLink, SectionHead } from "@/components/site/primitives";
import {
  EditorialSplit,
  EnquiryBand,
  IndexRows,
  Section,
  Statement,
  StatementBand,
  VehicleStrip,
} from "@/components/site/sections";
import { media } from "@/content/media";
import { routes } from "@/content/site";

export const metadata: Metadata = {
  title: "Supercar Experiences London | Chauffeur-Driven | CC City Chauffeurs",
  description:
    "Chauffeur-driven supercar experiences in London — statement arrivals, occasions and pre-arranged journeys in the Lamborghini Urus, Huracán and Revuelto.",
  alternates: { canonical: "/supercar-experiences" },
};

const occasions = [
  {
    title: "Arrivals",
    copy: "Pull up to the venue in something people look at, and step out of the back of it. The car does the work; you do not have to park it.",
    index: "01",
  },
  {
    title: "Birthdays and occasions",
    copy: "A car held for the evening rather than a fifteen-minute drive. Collections, dinner, and back again.",
    index: "02",
  },
  {
    title: "Proposals and celebrations",
    copy: "Route, timing and where the car waits, all agreed in advance so nothing has to be improvised on the night.",
    index: "03",
  },
  {
    title: "Photography and content",
    copy: "The vehicles are photographed regularly and present well. Arrangements for shoots are made on request.",
    index: "04",
  },
];

export default function SupercarExperiencesPage() {
  return (
    <>
      <PageHero
        eyebrow="Supercar experiences · Chauffeur-driven"
        display={["The arrival", "is the", "occasion"]}
        standfirst="Statement vehicles from the fleet, chauffeur-driven for select, pre-arranged journeys. All of the presence, none of the parking."
        image={media.fleetUrus}
        imageAlt="Lamborghini Urus in purple, photographed in the workshop"
        facts={[
          { label: "Basis", value: "Chauffeur-driven" },
          { label: "Booked", value: "Pre-arranged, by the hour or evening" },
          { label: "Also available", value: "Self-drive hire" },
        ]}
        actions={
          <>
            <GhostLink href={routes.quote}>Request a quote</GhostLink>
            <QuietLink href={routes.supercarHire}>Or drive it yourself</QuietLink>
          </>
        }
      />

      <Section tone="dark" className="pt-16 lg:pt-24">
        <Statement
          heading={["Chauffeur", "first —", "always"]}
          body="Supercars are part of what we do, not the whole of it. The same standards apply: a chauffeur presented formally, a car presented immaculately, and a journey planned before it starts."
        />
        <VehicleStrip ids={["urus", "huracan", "revuelto"]} label="Experience vehicles" />
      </Section>

      <Section tone="dark" className="pt-16 lg:pt-24">
        <SectionHead
          label="What people book this for"
          note="Pre-arranged, London and UK-wide"
          tone="dark"
        />
        <IndexRows rows={occasions} tone="dark" columns={2} />
      </Section>

      <StatementBand
        image={media.detailLamborghiniDoor}
        imageAlt="A Lamborghini door projection on the ground at night"
        eyebrow="The details"
        quote="The car should be the most memorable thing about the evening — and the least stressful."
      />

      <Section tone="dark" className="pt-20 lg:pt-28">
        <EditorialSplit
          image={media.urusSide}
          imageAlt="Lamborghini Urus in profile"
          eyebrow="How it works"
          heading="Booked like any other chauffeur job"
          paragraphs={[
            "Tell us the date, the collection point and roughly how long you need the car. Because these vehicles are kept for pre-arranged work, availability is confirmed rather than assumed — the earlier you ask, the better.",
            "If the occasion needs more than one vehicle, the rest of the fleet runs alongside on the same schedule.",
          ]}
          action={<GhostLink href={routes.fleet}>See the full fleet</GhostLink>}
          aspect="aspect-4/3"
        />
      </Section>

      <EnquiryBand
        heading="Tell us the occasion and the date."
        body="We will confirm which car is available and what it costs."
      />
    </>
  );
}
