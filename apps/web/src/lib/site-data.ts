import "server-only";

import type {
  FleetCategory,
  GalleryItem,
  HomepageSection,
  Service,
  SiteSettings,
  Testimonial,
  Vehicle,
  VehicleFeature,
} from "@CC-City-Chauffeurs/core";
import { env } from "@CC-City-Chauffeurs/env/web";

/**
 * What the website reads.
 *
 * Every page renders published records from the API rather than the data
 * files this site began with, so a change made in the admin shows here
 * without a deploy.
 *
 * Reads are cached for a minute and tagged, which keeps a busy page to one
 * request while still turning an editor's change around quickly. The bands
 * arrive with their references already resolved — a featured-fleet band
 * carries its vehicles — so no page has to make a second call to draw a
 * section.
 */

const BASE = `${env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, "")}/api/public`;

/** How long a published page may serve content the admin has since changed. */
const REVALIDATE = 60;

async function read<T>(path: string, tag: string): Promise<T | null> {
  try {
    const response = await fetch(`${BASE}${path}`, {
      next: { revalidate: REVALIDATE, tags: [tag, "site"] },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // The website must not go down because the API is having a moment. The
    // caller decides what an absent section looks like — usually nothing.
    return null;
  }
}

// ---------------------------------------------------------------- settings

export type SiteBundle = {
  settings: SiteSettings;
  enquiryServices: { value: string; label: string }[];
  navigation: { slug: string; name: string; summary: string }[];
};

export async function getSite() {
  return read<SiteBundle>("/site", "site-settings");
}

// ---------------------------------------------------------------- homepage

/** A band, with whatever it features already attached. */
export type HomepageBand = HomepageSection & {
  vehicles?: Vehicle[];
  services?: Service[];
};

export async function getHomepage() {
  return read<{ sections: HomepageBand[]; testimonials: Testimonial[] }>("/homepage", "homepage");
}

// ---------------------------------------------------------------- fleet

export type FleetBundle = {
  categories: (FleetCategory & { vehicles: Vehicle[] })[];
  vehicles: Vehicle[];
  features: VehicleFeature[];
};

export async function getFleet() {
  return read<FleetBundle>("/fleet", "fleet");
}

export async function getVehicle(slug: string) {
  return read<Vehicle>(`/fleet/${encodeURIComponent(slug)}`, "fleet");
}

// ---------------------------------------------------------------- services

export async function getServices() {
  return read<Service[]>("/services", "services");
}

export type ServicePage = Service & { vehicles: Vehicle[] };

export async function getService(slug: string) {
  return read<ServicePage>(`/services/${encodeURIComponent(slug)}`, "services");
}

// ---------------------------------------------------------------- gallery

export type GalleryBundle = {
  items: GalleryItem[];
  rows: { id: string; label: string }[];
};

export async function getGallery() {
  return read<GalleryBundle>("/gallery", "gallery");
}

// ---------------------------------------------------------------- testimonials

export async function getTestimonials() {
  return (await read<Testimonial[]>("/testimonials", "testimonials")) ?? [];
}
