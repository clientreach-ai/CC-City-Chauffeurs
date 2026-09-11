import type { Metadata } from "next";

import { Enquire } from "@/components/site/enquire";
import { Fleet } from "@/components/site/fleet";
import { Hero } from "@/components/site/hero";
import { Principles } from "@/components/site/principles";
import { SelfDrive } from "@/components/site/self-drive";
import { Services } from "@/components/site/services";
import { Statement } from "@/components/site/statement";
import { Testimonials } from "@/components/site/testimonials";
import { Weddings } from "@/components/site/weddings";
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
 * The homepage as a conversion journey, not a list of sections.
 *
 *   Hero       — position, then capture. The quote bar is the front door.
 *   Statement  — what the company is, and the facts we can evidence.
 *   Weddings   — ~70% of revenue and the client's own first priority, so it
 *                sits third rather than sixth. This is the single most
 *                commercially significant ordering decision on the page.
 *   Services   — the Phase 1 lines: airport, corporate, private.
 *   Fleet      — the strongest asset the business owns.
 *   Principles — professionalism, comfort, discretion, made concrete.
 *   SelfDrive  — the self-drive branch, clearly signposted off the spine.
 *   Enquire    — the ask.
 *
 * Corporate is no longer its own band; it is the featured tile inside
 * Services, which keeps it a Phase 1 priority without spending a full
 * section on a line the business has no accounts in yet.
 */
export default function Home() {
  // Order and numbering in one place — reordering the array renumbers the
  // page, so the two can never drift apart.
  const bands = [
    Statement,
    Weddings,
    Services,
    Fleet,
    Principles,
    SelfDrive,
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
