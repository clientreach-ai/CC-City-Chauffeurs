import type { Metadata } from "next";

import { GalleryGrid } from "@/components/site/gallery-grid";
import { PageHero } from "@/components/site/page-hero";
import { GhostLink, QuietLink, shell } from "@/components/site/primitives";
import { EnquiryBand } from "@/components/site/sections";
import { gallery } from "@/content/gallery";
import { media } from "@/content/media";
import { routes } from "@/content/site";

export const metadata: Metadata = {
  title: "Gallery | The Fleet, Photographed | CC City Chauffeurs",
  description:
    "Photographs of the CC City Chauffeurs fleet — Rolls-Royce Cullinan, Mercedes-AMG G-Wagon, Lamborghini Urus and more, shot across London and at the workshop.",
  alternates: { canonical: "/gallery" },
};

export default function GalleryPage() {
  return (
    <>
      <PageHero
        height="short"
        eyebrow="Gallery"
        display={["The cars,", "photographed"]}
        standfirst="From our own shoots — at hotel entrances across London, at Canary Wharf and North Greenwich, and in the workshop. Some of the cars pictured are from shoots rather than the current fleet list; the fleet page shows what can be booked today."
        image={media.collectionCanaryWharf}
        imageAlt="A Rolls-Royce Cullinan and a Ferrari SF90 against the Canary Wharf skyline at night"
        objectPosition="object-[center_45%]"
        facts={[
          { label: "Frames", value: `${gallery.length} photographs` },
          { label: "Shot in", value: "London and the workshop" },
          { label: "Vehicles", value: "Filter by car below" },
        ]}
        actions={
          <>
            <GhostLink href={routes.fleet}>See the fleet</GhostLink>
            <QuietLink href={routes.quote}>Request a quote</QuietLink>
          </>
        }
      />

      <section className="bg-ink text-white">
        <div className={`${shell} pt-16 pb-24 lg:pt-24 lg:pb-32`}>
          <GalleryGrid />
        </div>
      </section>

      <EnquiryBand
        heading="If you have seen the car you want, tell us the date."
        body="Availability is confirmed on enquiry — send the journey and we will come back with the vehicle and the price."
      />
    </>
  );
}
