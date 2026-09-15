import { notFound } from "next/navigation";

import { GalleryGrid } from "@/components/site/gallery-grid";
import { PageHero } from "@CC-City-Chauffeurs/ui/site/page-hero";
import { GhostLink, QuietLink, shell } from "@CC-City-Chauffeurs/ui/site/primitives";
import { EnquiryBand } from "@/components/site/sections";
import { media } from "@/content/media";
import { routes } from "@/content/site";
import { pageMetadata } from "@/content/seo";
import { getGallery } from "@/lib/site-data";

export const metadata = pageMetadata({
  title: "Gallery | The Fleet, Photographed | CC City Chauffeurs",
  description:
    "Photography from CC City Chauffeurs' own shoots — the Rolls-Royce Cullinan, Mercedes-AMG G-Wagon, Lamborghini Urus and more, across London and in the workshop.",
  path: "/gallery",
});

/** Published every minute from the admin's own records. */
export const revalidate = 60;

export default async function GalleryPage() {
  const gallery = await getGallery();
  if (!gallery) notFound();

  // The grid is presentational; map the records into what it draws.
  const images = gallery.items.map((item) => ({
    src: item.image.src,
    width: item.image.width,
    height: item.image.height,
    alt: item.image.alt,
    subject: item.row,
    place: item.location,
  }));

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
          { label: "Frames", value: `${images.length} photographs` },
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
          <GalleryGrid images={images} rows={gallery.rows} />
        </div>
      </section>

      <EnquiryBand
        heading="If you have seen the car you want, tell us the date."
        body="Availability is confirmed on enquiry — send the journey and we will come back with the vehicle and the price."
      />
    </>
  );
}
