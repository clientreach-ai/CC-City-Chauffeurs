import type { StaticImageData } from "next/image";

import { serviceOptions } from "@/content/enquiry";
import { fleetCategories, fleetVehicles, type VehicleId } from "@/content/fleet";
import { gallery, galleryFilters } from "@/content/gallery";
import { media, type MediaKey } from "@/content/media";
import { shareImage } from "@/content/seo";
import { services } from "@/content/services";
import {
  bookingTerms,
  contact,
  principles,
  routes,
  serviceAreas,
  site,
  WHATSAPP_INTRO,
} from "@/content/site";
import { testimonials } from "@/content/testimonials";
import type {
  ContentSeed,
  HomepageSection,
  ImageRef,
  MediaAsset,
  Vehicle,
  VehicleFeature,
} from "../types";

/**
 * The CMS content seed, built from the public site's own data files.
 *
 * SERVER-ONLY by convention: it imports the full service copy and the image
 * manifest. The admin layout builds it once and hands the result to the
 * browser as plain JSON, so none of `content/*` reaches the client bundle.
 *
 * Nothing here is new information. Every record is the website as it stands
 * after Stage 3 — the same vehicles, groupings, capacities, rates, services,
 * photographs and copy — so the admin opens on the real site rather than on
 * placeholder data. Where the site has no value (a vehicle's year, a street
 * address, a per-vehicle day rate), the field is left empty to be filled in
 * once the client confirms it.
 */

/** When the seeded content was last changed — the Stage 3 release. */
const CONTENT_DATE = "2026-09-11T09:00:00.000Z";

function imageRef(image: StaticImageData, alt: string): ImageRef {
  return { src: image.src, width: image.width, height: image.height, alt };
}

function mediaRef(key: MediaKey, alt: string): ImageRef {
  return { ...imageRef(media[key], alt), assetId: `site-${key}` };
}

/** The model half of each vehicle's name, as the client lists it. */
const models: Record<VehicleId, string> = {
  cullinan: "Cullinan",
  ghost: "Ghost",
  "flying-spur": "Flying Spur",
  "s-class": "S-Class",
  "range-rover": "Range Rover Vogue",
  "v-class": "V-Class",
  "v-class-jet": "V-Class JetClass",
  "g-wagon": "G-Wagon",
  bentayga: "Bentayga",
  urus: "Urus",
  huracan: "Huracán",
  revuelto: "Revuelto",
};

/**
 * "Standard in every car", as listed on the client intake (PRD Appendix B).
 * Child seats are Isofix boosters only, and on request.
 */
const features: VehicleFeature[] = [
  { id: "bottled-water", label: "Bottled water", note: "", position: 0 },
  { id: "phone-chargers", label: "Phone chargers", note: "", position: 1 },
  { id: "privacy-glass", label: "Privacy glass", note: "", position: 2 },
  { id: "rear-climate", label: "Rear climate control", note: "", position: 3 },
  { id: "umbrellas", label: "Umbrellas", note: "", position: 4 },
  { id: "isofix-boosters", label: "Isofix booster seats", note: "On request", position: 5 },
  { id: "refreshments", label: "Refreshments", note: "On request", position: 6 },
];

function hourlyRate(rate: string) {
  const match = rate.match(/£\s?(\d+)/);
  return match ? Number(match[1]) : null;
}

function buildVehicles(): Vehicle[] {
  return fleetVehicles.map((vehicle) => ({
    id: vehicle.id,
    slug: vehicle.id,
    name: vehicle.name,
    make: vehicle.marque,
    model: models[vehicle.id],
    categoryIds: fleetCategories
      .filter((category) => category.vehicles.includes(vehicle.id))
      .map((category) => category.id),
    shortDescription: vehicle.line,
    description: "",
    specs: {
      passengers: vehicle.passengers ? Number(vehicle.passengers) : null,
      luggage: vehicle.luggage ?? "",
      year: null,
      transmission: "",
      bodyType: "",
    },
    availability: vehicle.availability === "Chauffeur-driven" ? "chauffeur" : "chauffeur-or-self-drive",
    ownership: "unconfirmed",
    featureIds: features.map((feature) => feature.id),
    serviceIds: services
      .filter((service) => service.vehicles.includes(vehicle.id))
      .map((service) => service.slug),
    suitedTags: [...vehicle.suited],
    pricing: {
      hourlyRate: hourlyRate(vehicle.rate),
      dayRate: null,
      airportNote: "",
      notes: "",
    },
    images: {
      main: vehicle.image ? imageRef(vehicle.image, vehicle.imageAlt ?? vehicle.name) : null,
      gallery: [],
    },
    seo: { title: "", description: "", shareImage: null },
    status: "published",
    publishedAt: CONTENT_DATE,
    createdAt: CONTENT_DATE,
    updatedAt: CONTENT_DATE,
  }));
}

function buildHomepage(): HomepageSection[] {
  const base = (id: string, name: string, position: number) => ({
    id,
    name,
    visible: true,
    position,
    updatedAt: CONTENT_DATE,
  });

  return [
    {
      ...base("hero", "Hero", 0),
      kind: "hero",
      eyebrow: site.tagline,
      headingLines: ["The quiet", "luxury of", "being driven"],
      body: `${site.positioning} Chauffeur-driven travel across London, the UK and Europe.`,
      image: mediaRef("hero", "Rolls-Royce Cullinan waiting at a London hotel entrance at night"),
      primaryCta: { label: "Book a chauffeur", href: "#enquire" },
      secondaryCta: { label: "Explore the fleet", href: "#fleet" },
    },
    {
      ...base("statement", "Introduction", 1),
      kind: "statement",
      label: "A chauffeur company first",
      note: site.coverage,
      heading: "A luxury, discreet way of travelling — without the hassle.",
      body: "Discreet, professional chauffeur services for private clients, executives, wedding parties and corporate travel — planned around comfort, timing and confidentiality. London based, working across the United Kingdom and Europe.",
      signatureName: site.director,
      signatureRole: `Director, ${site.legalName}`,
      link: { label: "About the company", href: routes.about },
    },
    {
      ...base("services", "Featured services", 2),
      kind: "services",
      label: "Services",
      note: "Chauffeur-led, from a single transfer to a week",
      heading: "More than a car",
      body: "A morning that runs to time, a client collected properly, a wedding party where nothing is left to chance. The car is the visible part.",
      serviceIds: ["private-chauffeur", "airport-transfers", "corporate", "weddings", "events", "city-to-city"],
      cta: { label: "All chauffeur services", href: routes.services },
    },
    {
      ...base("fleet", "Featured fleet", 3),
      kind: "fleet",
      label: "The Fleet",
      note: "Indicative rates · Confirmed on enquiry",
      heading: "One fleet. One standard.",
      body: "Selected for rear-seat comfort, presence and discretion, and presented immaculately for every journey.",
      vehicleIds: ["cullinan", "g-wagon", "urus"],
      cta: { label: "View the full fleet", href: routes.fleet },
    },
    {
      ...base("principles", "Professionalism · Comfort · Discretion", 4),
      kind: "principles",
      eyebrow: "The way we work",
      quote: "The car is quiet. So is everything else about the service.",
      image: mediaRef("principlesCabin", "The rear cabin of a Rolls-Royce Cullinan"),
      items: principles.map((principle) => ({ title: principle.title, copy: principle.copy })),
    },
    {
      ...base("occasions", "Weddings & corporate", 5),
      kind: "occasions",
      label: "Weddings & corporate",
      note: "London · UK · Europe",
      panels: [
        {
          id: "weddings",
          eyebrow: "Weddings & private events",
          heading: "A day that runs to the minute",
          copy: "Weddings and private occasions make up the majority of our work. The principal car, vehicles for the wider party, and every timing agreed long before the morning itself.",
          image: mediaRef("weddings", "Rolls-Royce Cullinan waiting on a lit hotel forecourt"),
          primaryCta: { label: "Wedding chauffeur service", href: routes.service("weddings") },
          secondaryCta: { label: "Private events", href: routes.service("events") },
        },
        {
          id: "corporate",
          eyebrow: "Corporate travel",
          heading: "For people whose time is the asset",
          copy: "Executive travel, client transportation, roadshows and multi-day programmes — schedules held to the minute across London's business districts, the UK and Europe.",
          image: mediaRef("cullinanCanaryWharf", "Rolls-Royce Cullinan at Canary Wharf at night"),
          primaryCta: { label: "Corporate chauffeur service", href: routes.service("corporate") },
          secondaryCta: { label: "Roadshows", href: routes.service("roadshows") },
        },
      ],
    },
    {
      ...base("testimonials", "Testimonials", 6),
      kind: "testimonials",
      label: "In their words",
      note: "First name, role and district — with permission",
    },
    {
      ...base("enquire", "Enquiry", 7),
      kind: "enquire",
      label: "Enquire",
      heading: "Tell us the journey. We’ll come back with a price.",
      body: "No forms that go nowhere. Send the details however suits you — most of our clients simply message us — and we will confirm availability and cost.",
    },
  ];
}

function buildMedia(): MediaAsset[] {
  const assets: MediaAsset[] = [];
  const seen = new Set<string>();

  for (const [key, image] of Object.entries(media) as [MediaKey, StaticImageData][]) {
    if (seen.has(image.src)) continue;
    seen.add(image.src);
    assets.push({
      id: `site-${key}`,
      src: image.src,
      width: image.width,
      height: image.height,
      alt: "",
      filename: `${key}.jpg`,
      origin: "site",
      bytes: null,
      createdAt: CONTENT_DATE,
    });
  }

  assets.push({
    id: "site-share-card",
    src: shareImage.url,
    width: shareImage.width,
    height: shareImage.height,
    alt: shareImage.alt,
    filename: "city-chauffeurs.jpg",
    origin: "site",
    bytes: null,
    createdAt: CONTENT_DATE,
  });

  for (const image of gallery) {
    const filename = image.src.split("/").pop() ?? image.src;
    assets.push({
      id: `gallery-${filename.replace(/\.\w+$/, "")}`,
      src: image.src,
      width: image.width,
      height: image.height,
      alt: image.alt,
      filename,
      origin: "site",
      bytes: null,
      createdAt: CONTENT_DATE,
    });
  }

  return assets;
}

const fleetIds = new Set<string>(fleetVehicles.map((vehicle) => vehicle.id));

export function buildContentSeed(): ContentSeed {
  return {
    vehicles: buildVehicles(),
    fleetCategories: fleetCategories.map((category, position) => ({
      id: category.id,
      slug: category.id,
      title: category.title,
      summary: category.summary,
      position,
      status: "published",
      vehicleOrder: [...category.vehicles],
      createdAt: CONTENT_DATE,
      updatedAt: CONTENT_DATE,
    })),
    features,
    services: services.map((service, position) => ({
      id: service.slug,
      slug: service.slug,
      name: service.label,
      headline: [...service.display],
      summary: service.summary,
      standfirst: service.standfirst,
      heroImage: mediaRef(service.hero, service.heroAlt),
      facts: service.facts.map((fact) => ({ ...fact })),
      benefits: service.included.map((item) => ({ ...item })),
      detail: {
        heading: service.detail.heading,
        paragraphs: [...service.detail.paragraphs],
        image: mediaRef(service.detail.image, service.detail.imageAlt),
      },
      gallery: [],
      vehicleIds: [...service.vehicles],
      booking: { needs: [...service.booking.needs], note: service.booking.note },
      enquiry: { heading: service.closing, ctaLabel: "Request a quote" },
      seo: { ...service.seo },
      template: service.template,
      position,
      status: "published",
      publishedAt: CONTENT_DATE,
      createdAt: CONTENT_DATE,
      updatedAt: CONTENT_DATE,
    })),
    gallery: gallery.map((image, position) => {
      const filename = image.src.split("/").pop() ?? image.src;
      const id = `gallery-${filename.replace(/\.\w+$/, "")}`;
      return {
        id,
        image: { src: image.src, width: image.width, height: image.height, alt: image.alt, assetId: id },
        caption: "",
        location: image.place,
        vehicleId: fleetIds.has(image.subject) ? image.subject : null,
        row: image.subject,
        category: "vehicles",
        serviceIds: [],
        position,
        status: "published",
        createdAt: CONTENT_DATE,
        updatedAt: CONTENT_DATE,
      };
    }),
    galleryRows: galleryFilters
      .filter((filter) => filter.id !== "all")
      .map((filter) => ({ id: filter.id, label: filter.label })),
    // Empty on the live site, deliberately (PRD §4.3). Nothing is invented.
    testimonials: testimonials.map((item, position) => ({
      id: `testimonial-${position + 1}`,
      quote: item.quote,
      firstName: item.name,
      role: item.role,
      district: item.district,
      serviceId: null,
      date: "",
      permission: true,
      position,
      status: "published",
      createdAt: CONTENT_DATE,
      updatedAt: CONTENT_DATE,
    })),
    homepage: buildHomepage(),
    settings: {
      business: {
        companyName: site.name,
        legalName: site.legalName,
        director: site.director,
        tagline: site.tagline,
        positioning: site.positioning,
        address: "",
        base: site.base,
        coverage: site.coverage,
        serviceAreas: [...serviceAreas],
      },
      contact: {
        phoneDisplay: contact.phoneDisplay,
        phoneE164: contact.phoneE164,
        whatsappDisplay: contact.mobileDisplay,
        whatsappNumber: contact.whatsappNumber,
        whatsappIntro: WHATSAPP_INTRO,
        email: contact.email,
        responseNote: "",
      },
      booking: { terms: [...bookingTerms] },
      social: [],
      seo: {
        siteUrl: site.url,
        siteTitle: "CC City Chauffeurs | Luxury Chauffeur Service, London",
        defaultDescription:
          "A luxury, discreet way of travelling — without the hassle. Chauffeur services across London, the UK and Europe.",
        shareImage: {
          src: shareImage.url,
          width: shareImage.width,
          height: shareImage.height,
          alt: shareImage.alt,
          assetId: "site-share-card",
        },
      },
      footer: {
        text: site.positioning,
        showServiceLinks: true,
        showServiceAreas: true,
        showContact: true,
      },
      updatedAt: CONTENT_DATE,
    },
    media: buildMedia(),
    enquiryServices: serviceOptions.map((option) => ({ value: option.value, label: option.label })),
  };
}
