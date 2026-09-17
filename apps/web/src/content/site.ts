import type { Route } from "next";

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
  director: "Mr F. Fareed",
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
  /*
   * WhatsApp — the number the client's existing site links every WhatsApp
   * button to (wa.me/447804429407). PRD §17 Q2 is still open on which single
   * mobile number the business standardises on; change it here only.
   */
  mobileDisplay: "07804 429407",
  whatsappNumber: "447804429407",
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
  /** The quote form with a service already chosen. */
  quoteFor: (service: string) => `/request-a-quote?service=${service}` as Route,
  /*
   * A booking *request*, for someone who already knows the date. It is not a
   * reservation — there is no availability to check against and nothing is
   * held until the office confirms it — so it is deliberately a separate
   * route from the quote, which is where an unsettled date belongs.
   */
  book: "/book" as Route,
  /** The booking form with a service already chosen. */
  bookFor: (service: string) => `/book?service=${service}` as Route,
} as const;

export type NavItem = { label: string; href: Route; note?: string };
export type NavGroup = { label: string; href: Route; items: readonly NavItem[] };

export const navLinks: readonly NavItem[] = [
  { label: "Fleet", href: routes.fleet },
  { label: "Gallery", href: routes.gallery },
  { label: "About", href: routes.about },
  { label: "Book", href: routes.book },
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

/**
 * Short factual notes used across the site.
 *
 * GATED CLAIMS — do not re-add without written evidence from the client:
 *
 *   "Fully licensed and insured"
 *     Blocked by PRD §4.4 / Q1. The client answered "no" to holding a private
 *     hire operator licence while naming TfL as their authority. Until that
 *     position is established in writing, the site may not claim it.
 *
 *   "Professionally vetted and background-checked"
 *     Not evidenced. Unblocks on sight of the vetting process.
 *
 *   "Trained in discretion and client confidentiality"
 *     Blocked by PRD §10.11 — the client answered "none" to what training
 *     chauffeurs receive. Unblocks if a standards induction is introduced.
 *
 * Everything below is supported by the client intake.
 */
export const assurances = [
  "Meet & greet at all London airports",
  "Flight tracking and luggage assistance",
  "60 minutes complimentary waiting after landing",
  "Four-hour minimum booking",
  "London based — UK and Europe",
  "Discreet enquiries, handled promptly",
] as const;

/**
 * How chauffeurs are presented. Descriptive of the service the client
 * describes providing — no training, vetting or certification claims.
 * See the gated list above.
 */
export const chauffeurStandards = [
  "Presented formally for every booking",
  "Routes planned and checked before the day",
  "Knowledgeable of London and UK routes",
  "Experienced with private and corporate clients",
  "Names withheld — faces shown, identities kept private",
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

/**
 * Terms that apply across chauffeur bookings, as given on the client intake
 * (PRD Appendix A). Cancellation wording is still being confirmed (PRD §17
 * Q6), so it is deliberately not published.
 */
export const bookingTerms = [
  "We ask for 48 hours' notice wherever possible.",
  "Bank holidays, Congestion Charge and ULEZ, airport parking and additional stops are charged on top of the journey.",
] as const;
