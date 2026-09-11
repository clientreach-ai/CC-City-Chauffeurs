import type { Metadata } from "next";

import { Enquire } from "@/components/site/enquire";
import { Fleet } from "@/components/site/fleet";
import { Hero } from "@/components/site/hero";
import { Occasions } from "@/components/site/occasions";
import { Principles } from "@/components/site/principles";
import { Services } from "@/components/site/services";
import { Statement } from "@/components/site/statement";
import { Testimonials } from "@/components/site/testimonials";
import { testimonials } from "@/content/testimonials";

export const metadata: Metadata = {
  title: "CC City Chauffeurs | Luxury Chauffeur Service, London",
  description:
    "A luxury, discreet way of travelling — without the hassle. Chauffeur-driven travel for private clients, executives, weddings and corporate accounts across London, the UK and Europe.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "CC City Chauffeurs | Luxury Chauffeur Service, London",
    description:
      "Chauffeur-driven travel for private clients, executives, weddings and corporate accounts. London based. UK & Europe.",
    locale: "en_GB",
    type: "website",
  },
};

/**
 * The homepage is a first impression, not the whole site. Each band says one
 * thing and hands off to the page that says the rest:
 *
 *   Hero       — the vehicle first, the positioning second.
 *   Statement  — a chauffeur company first, in one paragraph.        → /about
 *   Services   — the six services most people come for.              → /chauffeur-services
 *   Fleet      — three photographed vehicles, supercars signposted.  → /fleet
 *   Principles — professionalism, comfort, discretion.
 *   Occasions  — weddings and corporate, side by side.               → service pages
 *   Enquire    — the ask.
 */
export default function Home() {
  // Order and numbering in one place — reordering the array renumbers the
  // page, so the two can never drift apart.
  const bands = [
    Statement,
    Services,
    Fleet,
    Principles,
    Occasions,
    // Only takes a number once there are real quotes to show, so the
    // numbering never skips a band the visitor cannot see.
    ...(testimonials.length > 0 ? [Testimonials] : []),
    Enquire,
  ];

  return (
    <>
      <Hero />
      {bands.map((Band, i) => {
        // Position is the identity here: the list is static and never
        // reordered at runtime, and function names do not survive minification.
        const index = String(i + 1).padStart(2, "0");
        return <Band key={index} index={index} />;
      })}
    </>
  );
}
