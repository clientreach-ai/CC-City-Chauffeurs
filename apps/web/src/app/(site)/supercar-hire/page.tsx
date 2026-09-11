import type { Metadata } from "next";

import { PageHero } from "@/components/site/page-hero";
import { GhostLink, QuietLink, SectionHead } from "@/components/site/primitives";
import {
  EditorialSplit,
  EnquiryBand,
  IndexRows,
  Section,
  Statement,
  VehicleStrip,
} from "@/components/site/sections";
import { media } from "@/content/media";
import { routes } from "@/content/site";

export const metadata: Metadata = {
  title: "Supercar Hire London | Self-Drive | CC City Chauffeurs",
  description:
    "Self-drive supercar hire in London — Lamborghini Urus, Huracán and Revuelto. Subject to driver eligibility and insurance requirements. Terms confirmed on enquiry.",
  alternates: { canonical: "/supercar-hire" },
};

const conditions = [
  {
    title: "Driver eligibility",
    copy: "Self-drive hire is subject to age, licence and driving history requirements. These are confirmed before a booking is accepted rather than at collection.",
    index: "01",
  },
  {
    title: "Insurance",
    copy: "Cover has to be arranged and confirmed for each hire. Tell us who will be driving and we will set out what is required.",
    index: "02",
  },
  {
    title: "Deposit and terms",
    copy: "A security deposit and hire terms apply. Both are set out in writing before anything is agreed — there is nothing to read at the kerbside.",
    index: "03",
  },
  {
    title: "Mileage and use",
    copy: "Daily mileage and permitted use are agreed at the point of booking so there are no surprises at the end of the hire.",
    index: "04",
  },
  {
    title: "Handover",
    copy: "The car is presented and handed over properly, with time taken to walk through it. It is not a keys-and-go transaction.",
    index: "05",
  },
];

export default function SupercarHirePage() {
  return (
    <>
      <PageHero
        eyebrow="Supercar hire · Self drive"
        display={["Take", "the wheel"]}
        standfirst="Selected supercars from the fleet, available to hire without a chauffeur. Subject to driver eligibility and insurance requirements, with terms agreed before the booking is confirmed."
        image={media.fleetUrus}
        imageAlt="Lamborghini Urus in purple, photographed in the workshop"
        objectPosition="object-[center_45%]"
        facts={[
          { label: "Basis", value: "Self drive, by arrangement" },
          { label: "Terms", value: "Eligibility and insurance apply" },
          { label: "Also available", value: "Chauffeur-driven" },
        ]}
        actions={
          <>
            <GhostLink href={routes.quote}>Enquire about hire</GhostLink>
            <QuietLink href={routes.supercarExperiences}>
              Or be driven in one
            </QuietLink>
          </>
        }
      />

      <Section tone="dark" className="pt-16 lg:pt-24">
        <Statement
          heading={["A specific car,", "agreed in", "advance"]}
          body="You know exactly which car you are booking before anything is agreed, and every condition that comes with it is set out before the booking is confirmed — not discovered at the handover."
        />
        <VehicleStrip
          ids={["urus", "huracan", "revuelto"]}
          label="Available for self-drive hire"
        />
      </Section>

      <Section tone="dark" className="pt-16 lg:pt-24">
        <SectionHead
          label="What applies to every hire"
          note="Confirmed in writing before booking"
          tone="dark"
        />
        <IndexRows rows={conditions} tone="dark" columns={2} />
        <p className="label-xs mt-10 max-w-[62ch] text-white/55">
          Specific requirements — minimum age, licence held, deposit and mileage —
          depend on the vehicle and are confirmed on enquiry.
        </p>
      </Section>

      <Section tone="dark" className="pt-20 lg:pt-28">
        <EditorialSplit
          image={media.urusCockpit}
          imageAlt="The cockpit of a Lamborghini Urus"
          eyebrow="Before you decide"
          heading="Chauffeur-driven is often the better booking"
          paragraphs={[
            "For arrivals, occasions and anything involving central London on a Friday evening, being driven is usually the better experience — you get the car, the photographs and the arrival without the parking, the congestion charge or the responsibility.",
            "The same vehicles are available chauffeur-driven. If you are undecided, say what the day is for and we will tell you honestly which one suits it.",
          ]}
          action={<GhostLink href={routes.supercarExperiences}>Supercar experiences</GhostLink>}
          aspect="aspect-4/3"
          flip
        />
      </Section>

      <EnquiryBand
        heading="Tell us the dates and who is driving."
        body="We will come back with availability, the terms that apply and a price."
      />
    </>
  );
}
