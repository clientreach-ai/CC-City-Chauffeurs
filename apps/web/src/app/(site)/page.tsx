import type { Metadata } from "next";

import { Corporate } from "@/components/site/corporate";
import { Enquire } from "@/components/site/enquire";
import { Fleet } from "@/components/site/fleet";
import { Hero } from "@/components/site/hero";
import { Principles } from "@/components/site/principles";
import { SelfDrive } from "@/components/site/self-drive";
import { Services } from "@/components/site/services";
import { Statement } from "@/components/site/statement";
import { Weddings } from "@/components/site/weddings";

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

export default function Home() {
  return (
    <>
      <Hero />
      <Statement />
      <Services />
      <Fleet />
      <Principles />
      <Corporate />
      <Weddings />
      <SelfDrive />
      <Enquire />
    </>
  );
}
