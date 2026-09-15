import { notFound } from "next/navigation";

import { Enquire } from "@/components/site/enquire";
import { Fleet } from "@/components/site/fleet";
import { Hero } from "@/components/site/hero";
import { Occasions } from "@/components/site/occasions";
import { Principles } from "@/components/site/principles";
import { Services } from "@/components/site/services";
import { Statement } from "@/components/site/statement";
import { Testimonials } from "@/components/site/testimonials";
import { getFleet, getHomepage, getSite, type HomepageBand } from "@/lib/site-data";
import { pageMetadata } from "@/content/seo";

export const metadata = pageMetadata({
  title: "Luxury Chauffeur Service London | CC City Chauffeurs",
  description:
    "Luxury chauffeur service in London — private chauffeurs, airport transfers, weddings and corporate travel across Mayfair, Knightsbridge, the UK and Europe.",
  path: "/",
});

/**
 * The homepage is a first impression, not the whole site. Each band says one
 * thing and hands off to the page that says the rest.
 *
 * Which bands appear, in what order, and every word in them, is set in the
 * admin. The hero opens the page and is always shown; the rest are numbered
 * in the order they are actually rendered, so hiding a band renumbers the
 * page rather than leaving a gap.
 */
export default async function Home() {
  const [home, site, fleet] = await Promise.all([getHomepage(), getSite(), getFleet()]);
  if (!home || !site) notFound();

  const hero = home.sections.find((section) => section.kind === "hero");
  const bands = home.sections.filter((section) => section.kind !== "hero");
  const marquee = (fleet?.vehicles ?? []).map((vehicle) => vehicle.name);

  let printed = 0;
  /** Only a band that renders takes a number. */
  const nextIndex = () => String(++printed).padStart(2, "0");

  return (
    <>
      {hero ? <Hero section={hero} settings={site.settings} /> : null}

      {bands.map((band: HomepageBand) => {
        switch (band.kind) {
          case "statement":
            return <Statement key={band.id} index={nextIndex()} section={band} />;
          case "services":
            return (
              <Services
                key={band.id}
                index={nextIndex()}
                section={band}
                all={site.navigation}
              />
            );
          case "fleet":
            return <Fleet key={band.id} index={nextIndex()} section={band} marquee={marquee} />;
          case "principles":
            return <Principles key={band.id} index={nextIndex()} section={band} />;
          case "occasions":
            return <Occasions key={band.id} index={nextIndex()} section={band} />;
          case "testimonials":
            // Takes a number only when there is something to show, so the
            // numbering never skips a band the visitor cannot see.
            return home.testimonials.length ? (
              <Testimonials
                key={band.id}
                index={nextIndex()}
                section={band}
                items={home.testimonials}
              />
            ) : null;
          case "enquire":
            return (
              <Enquire
                key={band.id}
                index={nextIndex()}
                section={band}
                settings={site.settings}
                services={site.enquiryServices}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
