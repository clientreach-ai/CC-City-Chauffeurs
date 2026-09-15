import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { PageHero } from "@CC-City-Chauffeurs/ui/site/page-hero";
import { GhostLink, QuietLink, SectionHead } from "@CC-City-Chauffeurs/ui/site/primitives";
import { EnquiryBand, Section, Statement, StatementBand } from "@/components/site/sections";
import { Reveal } from "@CC-City-Chauffeurs/ui/site/reveal";
import { media } from "@/content/media";
import { chauffeurStandards, routes } from "@/content/site";
import { pageMetadata } from "@/content/seo";
import { getServices } from "@/lib/site-data";

export const metadata = pageMetadata({
  title: "Chauffeur Services London | CC City Chauffeurs",
  description:
    "Chauffeur services in London and UK-wide — private chauffeur, airport transfers, corporate travel, weddings, events, city to city, roadshows and tours.",
  path: "/chauffeur-services",
});

/** Published every minute from the admin's own records. */
export const revalidate = 60;

const numeral = (i: number) => `0${i + 1}`.slice(-2);

export default async function ChauffeurServicesPage() {
  const services = await getServices();
  const [feature, ...rest] = services ?? [];
  if (!feature) notFound();

  return (
    <>
      <PageHero
        eyebrow="Chauffeur services"
        display={[`${services!.length} ways`, "to be", "driven"]}
        standfirst="From a single airport collection to a week-long corporate programme. Every service below is chauffeur-led, planned in advance and run to your schedule."
        image={media.cullinanPeninsulaNight}
        imageAlt="Rolls-Royce Cullinan waiting outside The Peninsula in London"
        facts={[
          { label: "Based", value: "London · UK & Europe" },
          { label: "Booked", value: "By the hour, day or programme" },
          { label: "Fleet", value: "Chauffeur-driven throughout" },
        ]}
        actions={
          <>
            <GhostLink href={routes.quote}>Request a quote</GhostLink>
            <QuietLink href={routes.fleet}>See the fleet</QuietLink>
          </>
        }
      />

      {/* Lead service, given its own editorial spread */}
      <Section tone="dark" className="pt-16 lg:pt-24">
        <Statement
          heading={["The chauffeur", "is the", "service"]}
          body="The car is what people photograph. The chauffeur is what they remember — the collection that happened on time, the route that avoided the closure, the door that opened before anyone reached for it."
        />

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
          <Reveal variant="image" className="lg:col-span-7">
            <Link href={routes.service(feature.slug)} className="group block">
              <div className="media-zoom relative aspect-4/3 w-full overflow-hidden bg-graphite sm:aspect-16/10">
                {feature.heroImage ? (
                  <Image
                    src={feature.heroImage.src}
                    alt={feature.heroImage.alt}
                    fill
                    quality={85}
                    sizes="(max-width: 1024px) 100vw, 58vw"
                    className="object-cover transition-transform duration-[1600ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:scale-[1.02]"
                  />
                ) : null}
              </div>
            </Link>
          </Reveal>

          <div className="lg:col-span-5">
            <Reveal delay={80}>
              <p className="label-xs text-white/55">
                ({numeral(0)}) Most requested
              </p>
              <h3 className="display-md mt-4 text-white">{feature.name}</h3>
              <p className="copy-lg mt-6 max-w-[44ch] text-white/65">
                {feature.standfirst}
              </p>
            </Reveal>

            <Reveal delay={160} className="mt-9">
              <GhostLink href={routes.service(feature.slug)}>
                {feature.name}
              </GhostLink>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* The remaining services as an editorial index */}
      <Section tone="dark" className="pt-16 lg:pt-24">
        <SectionHead
          label="Every chauffeur service"
          note="Chauffeur-led, London and UK-wide"
          tone="dark"
        />

        <ul>
          {rest.map((service, i) => (
            <Reveal
              as="li"
              key={service.slug}
              delay={Math.min(i * 45, 250)}
              className="group border-t border-hairline last:border-b"
            >
              <Link
                href={routes.service(service.slug)}
                className="grid grid-cols-1 gap-x-12 gap-y-4 py-8 sm:py-10 lg:grid-cols-12"
              >
                <span className="label-xs text-white/55 lg:col-span-1">
                  {numeral(i + 1)}
                </span>
                <h3 className="display-md text-white transition-transform duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:translate-x-1.5 lg:col-span-5">
                  {service.name}
                </h3>
                <p className="copy max-w-[56ch] text-white/60 lg:col-span-5">
                  {service.summary}
                </p>
                <span
                  aria-hidden
                  className="label-xs text-white opacity-0 transition-opacity duration-500 group-hover:opacity-100 lg:col-span-1 lg:text-right"
                >
                  View
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </Section>

      <StatementBand
        image={media.cullinanRearCabin}
        imageAlt="The rear cabin of a Rolls-Royce Cullinan"
        eyebrow="The standard"
        quote="Whatever the booking says, the job is the same: get there properly, and get there on time."
        objectPosition="object-[60%_center]"
      />

      <Section tone="dark" className="pt-16 lg:pt-24">
        <SectionHead label="Our chauffeurs" note="On every booking" />
        <div className="grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <h2 className="display-lg max-w-[14ch] text-white">
              Presented and briefed
            </h2>
          </Reveal>
          <Reveal delay={100} className="lg:col-span-6 lg:col-start-7">
            <ul>
              {chauffeurStandards.map((standard) => (
                <li
                  key={standard}
                  className="label-sm border-b border-hairline py-5 text-white/70 first:border-t"
                >
                  {standard}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>

      <EnquiryBand
        heading="Tell us the journey. We'll come back with a price."
        body="Send the details however suits you — most of our clients simply message us — and we will confirm availability and cost."
      />
    </>
  );
}
