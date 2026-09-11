import type { Route } from "next";

import { services } from "./services";

/**
 * Business facts for CC City Chauffeurs.
 *
 * Everything here is taken from the client's existing website
 * (city-chauffeurs.com) or the client intake. Nothing is invented — no
 * testimonials, statistics, accreditations or availability claims.
 *
 * Note: the old site's "24/7 availability" claim has deliberately NOT been
 * carried over — the client confirmed it is not accurate.
 */

export const site = {
  name: "City Chauffeurs",
  legalName: "CC City Chauffeurs",
  director: "Faheem Fareed",
  tagline: "Your city. Your chauffeur.",
  positioning: "A luxury, discreet way of travelling — without the hassle.",
  base: "London, United Kingdom",
  coverage: "London based. UK & Europe.",
  url: "https://www.city-chauffeurs.com",
} as const;

export const contact = {
  phoneDisplay: "020 8443 3332",
  phoneHref: "tel:+442084433332",
  phoneE164: "+442084433332",
  mobileDisplay: "07370 955161",
  whatsappNumber: "447370955161",
  email: "enquiries@city-chauffeurs.com",
  emailHref: "mailto:enquiries@city-chauffeurs.com",
} as const;

/** Opens WhatsApp with an optional prefilled message. */
export function whatsappUrl(message?: string) {
  const base = `https://wa.me/${contact.whatsappNumber}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export const WHATSAPP_INTRO =
  "Hello City Chauffeurs, I'd like to enquire about a chauffeur booking.";

/**
 * Routes. `typedRoutes` is on, so anything built from data is cast once here
 * rather than at every call site.
 */
export const routes = {
  home: "/" as Route,
  services: "/chauffeur-services" as Route,
  service: (slug: string) => `/chauffeur-services/${slug}` as Route,
  supercarHire: "/supercar-hire" as Route,
  supercarExperiences: "/supercar-experiences" as Route,
  fleet: "/fleet" as Route,
  gallery: "/gallery" as Route,
  about: "/about" as Route,
  contact: "/contact" as Route,
  quote: "/request-a-quote" as Route,
} as const;

export type NavItem = { label: string; href: Route; note?: string };
export type NavGroup = { label: string; href: Route; items: readonly NavItem[] };

export const navGroups: readonly NavGroup[] = [
  {
    label: "Chauffeur",
    href: routes.services,
    items: services.map((service) => ({
      label: service.label,
      href: routes.service(service.slug),
      note: service.summary,
    })),
  },
  {
    label: "Supercar",
    href: routes.supercarHire,
    items: [
      {
        label: "Supercar Hire",
        href: routes.supercarHire,
        note: "Self-drive hire, subject to driver eligibility and insurance.",
      },
      {
        label: "Supercar Experiences",
        href: routes.supercarExperiences,
        note: "Chauffeur-driven statement cars for arrivals and occasions.",
      },
    ],
  },
];

export const navLinks: readonly NavItem[] = [
  { label: "Fleet", href: routes.fleet },
  { label: "Gallery", href: routes.gallery },
  { label: "About", href: routes.about },
  { label: "Contact", href: routes.contact },
];

export const serviceAreas = [
  "Mayfair",
  "Knightsbridge",
  "Chelsea",
  "Kensington",
  "Fulham",
  "Canary Wharf",
] as const;

/** Short factual notes used across the site. Each is supported by the intake. */
export const assurances = [
  "Fully licensed and insured",
  "Professionally vetted chauffeurs",
  "Meet & greet at all London airports",
  "Flight tracking and luggage assistance",
  "60 minutes complimentary waiting after landing",
  "Discreet enquiries, handled promptly",
] as const;

export const chauffeurStandards = [
  "Professionally vetted and background-checked",
  "Presented to the highest standards",
  "Trained in discretion and client confidentiality",
  "Knowledgeable of London and UK routes",
  "Experienced with high-profile and private clients",
] as const;

export const principles = [
  {
    title: "Professionalism",
    copy: "Every journey is conducted with the highest level of professionalism and attention to detail — from the standard of presentation to the route planned before you step outside.",
  },
  {
    title: "Comfort",
    copy: "A rear-seat focused service, ensuring our clients travel in complete comfort. Vehicles are chosen for the quality of the seat you sit in, not the badge on the bonnet.",
  },
  {
    title: "Discretion",
    copy: "Absolute confidentiality for every client, every journey. Names, destinations and schedules stay between us.",
  },
] as const;
