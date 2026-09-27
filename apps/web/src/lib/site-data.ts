import "server-only";

import { cache } from "react";

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

const BASE = `${env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, "")}/api/public`;

const REVALIDATE = 60;

const BUILDING = process.env.NEXT_PHASE === "phase-production-build";


const TIMEOUT_MS = BUILDING ? 30_000 : 10_000;

const ATTEMPTS = BUILDING ? 4 : 1;
const BETWEEN_ATTEMPTS_MS = 1_000;

const worthRetrying = (error: unknown) =>
  error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError" || error.name === "TypeError");

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


const read = cache(async function read<T>(path: string, tag: string): Promise<T | null> {
  let unreachable: unknown;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${BASE}${path}`, {
        next: { revalidate: REVALIDATE, tags: [tag, "site"] },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {

      if (!worthRetrying(error) || attempt === ATTEMPTS) throw error;
      unreachable = error;
      await wait(BETWEEN_ATTEMPTS_MS * attempt);
      continue;
    }

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`The API answered ${response.status} for ${path}.`);
    }
    return (await response.json()) as T;
  }

  throw unreachable ?? new Error(`The API could not be read for ${path}.`);
}) as <T>(path: string, tag: string) => Promise<T | null>;


export type SiteBundle = {
  settings: SiteSettings;
  enquiryServices: { value: string; label: string }[];
  navigation: { slug: string; name: string; summary: string }[];
};

export async function getSite() {
  return read<SiteBundle>("/site", "site-settings");
}

export type HomepageBand = HomepageSection & {
  vehicles?: Vehicle[];
  services?: Service[];
};

export async function getHomepage() {
  return read<{ sections: HomepageBand[]; testimonials: Testimonial[] }>("/homepage", "homepage");
}

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

export async function getServices() {
  return read<Service[]>("/services", "services");
}

export type ServicePage = Service & { vehicles: Vehicle[] };

export async function getService(slug: string) {
  return read<ServicePage>(`/services/${encodeURIComponent(slug)}`, "services");
}
export type GalleryBundle = {
  items: GalleryItem[];
  rows: { id: string; label: string }[];
};

export async function getGallery() {
  return read<GalleryBundle>("/gallery", "gallery");
}

export async function getTestimonials() {
  return (await read<Testimonial[]>("/testimonials", "testimonials")) ?? [];
}
