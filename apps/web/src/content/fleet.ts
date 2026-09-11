import { media } from "./media";
import type { StaticImageData } from "next/image";

/**
 * The fleet.
 *
 * The four groupings below are the client's own and must not be renamed or
 * merged. Vehicles deliberately appear in more than one grouping where the
 * client lists them twice (the Cullinan and Range Rover are both core
 * chauffeur cars and high-profile SUVs).
 *
 * Indicative hourly rates come from the client intake: Cullinan £200,
 * Urus £150, G-Wagon £125, S-Class £90, V-Class £75. Everything else reads
 * "On request" rather than being guessed at.
 *
 * TODO (client to confirm):
 *  - Passenger and luggage figures are the standard configuration for each
 *    model and should be checked against the actual vehicles.
 *  - Photography exists for the Cullinan, G-Wagon, Urus and the JetClass
 *    cabin. Everything else renders as a typographic plate until photographs
 *    arrive — see `VehiclePlate` in components/site/sections.tsx.
 *  - The client's photography also includes a Ferrari SF90 and a Rolls-Royce
 *    Wraith Black Badge, neither of which appears in the fleet list they
 *    supplied. Both are currently shown in the gallery only.
 */

export type VehicleId =
  | "cullinan"
  | "ghost"
  | "flying-spur"
  | "s-class"
  | "range-rover"
  | "v-class"
  | "v-class-8"
  | "v-class-jet"
  | "g-wagon"
  | "bentayga"
  | "urus"
  | "huracan"
  | "revuelto";

export type Vehicle = {
  id: VehicleId;
  name: string;
  marque: string;
  /** Short editorial line. Descriptive, never a specification claim. */
  line: string;
  passengers: string;
  luggage: string;
  availability: "Chauffeur-driven" | "Chauffeur or self-drive";
  rate: string;
  /** Which services this vehicle is typically used for. */
  suited: readonly string[];
  image?: StaticImageData;
  imageAlt?: string;
};

export const vehicles: Record<VehicleId, Vehicle> = {
  cullinan: {
    id: "cullinan",
    name: "Rolls-Royce Cullinan",
    marque: "Rolls-Royce",
    line: "The pinnacle of chauffeur-driven travel — commanding presence outside, an unrivalled rear-seat sanctuary inside.",
    passengers: "3",
    luggage: "2 large cases",
    availability: "Chauffeur-driven",
    rate: "From £200 / hour",
    suited: ["Weddings", "Corporate", "Airport transfers"],
    image: media.fleetCullinan,
    imageAlt: "Rolls-Royce Cullinan in black, photographed in the workshop",
  },
  ghost: {
    id: "ghost",
    name: "Rolls-Royce Ghost",
    marque: "Rolls-Royce",
    line: "Refined chauffeur-driven luxury for private clients — the quietest way to cross a city.",
    passengers: "3",
    luggage: "3 cases",
    availability: "Chauffeur-driven",
    rate: "On request",
    suited: ["Weddings", "Private clients", "Occasions"],
  },
  "flying-spur": {
    id: "flying-spur",
    name: "Bentley Flying Spur",
    marque: "Bentley",
    line: "British luxury with a long-distance temperament — composed at speed, unhurried in traffic.",
    passengers: "3",
    luggage: "3 cases",
    availability: "Chauffeur-driven",
    rate: "On request",
    suited: ["City to city", "Corporate", "Weddings"],
  },
  "s-class": {
    id: "s-class",
    name: "Mercedes S-Class",
    marque: "Mercedes-Benz",
    line: "Executive chauffeur travel with understated elegance — the working standard for business days.",
    passengers: "3",
    luggage: "2 large cases",
    availability: "Chauffeur-driven",
    rate: "From £90 / hour",
    suited: ["Corporate", "Airport transfers", "Roadshows"],
  },
  "range-rover": {
    id: "range-rover",
    name: "Range Rover Vogue",
    marque: "Land Rover",
    line: "Elevated chauffeur travel with commanding presence and a genuinely comfortable rear cabin.",
    passengers: "4",
    luggage: "4 cases",
    availability: "Chauffeur-driven",
    rate: "On request",
    suited: ["Airport transfers", "Family travel", "Corporate"],
  },
  "v-class": {
    id: "v-class",
    name: "Mercedes V-Class",
    marque: "Mercedes-Benz",
    line: "Chauffeur-driven group travel without the compromise — everyone arrives together, and comfortably.",
    passengers: "6",
    luggage: "5 cases",
    availability: "Chauffeur-driven",
    rate: "From £75 / hour",
    suited: ["Groups", "Airport transfers", "Events"],
  },
  "v-class-8": {
    id: "v-class-8",
    name: "Mercedes V-Class 8 Seater",
    marque: "Mercedes-Benz",
    line: "The full eight-seat configuration for larger parties, luggage and airport runs.",
    passengers: "8",
    luggage: "Group luggage",
    availability: "Chauffeur-driven",
    rate: "From £75 / hour",
    suited: ["Groups", "Weddings", "Airport transfers"],
  },
  "v-class-jet": {
    id: "v-class-jet",
    name: "V-Class JetClass 4 Seater",
    marque: "Mercedes-Benz",
    line: "A private-cabin conversion with lounge seating — a meeting room that happens to be moving.",
    passengers: "4",
    luggage: "Group luggage",
    availability: "Chauffeur-driven",
    rate: "On request",
    suited: ["Roadshows", "Corporate", "Long distance"],
    image: media.fleetGroup,
    imageAlt: "The lounge-style cabin of a JetClass V-Class conversion",
  },
  "g-wagon": {
    id: "g-wagon",
    name: "Mercedes G-Wagon",
    marque: "Mercedes-AMG",
    line: "Distinctive, secure and high-profile — the squared silhouette that commands every street it occupies.",
    passengers: "4",
    luggage: "3 cases",
    availability: "Chauffeur-driven",
    rate: "From £125 / hour",
    suited: ["Private clients", "Events", "Occasions"],
    image: media.fleetGWagon,
    imageAlt: "Mercedes-AMG G-Wagon in matte black",
  },
  bentayga: {
    id: "bentayga",
    name: "Bentley Bentayga",
    marque: "Bentley",
    line: "Performance luxury with exceptional rear-seat comfort — an SUV that travels like a saloon.",
    passengers: "4",
    luggage: "3 cases",
    availability: "Chauffeur-driven",
    rate: "On request",
    suited: ["Weddings", "Corporate", "City to city"],
  },
  urus: {
    id: "urus",
    name: "Lamborghini Urus",
    marque: "Lamborghini",
    line: "Performance-led luxury SUV for statement journeys, chauffeur-driven or self-drive by arrangement.",
    passengers: "4",
    luggage: "2 cases",
    availability: "Chauffeur or self-drive",
    rate: "From £150 / hour",
    suited: ["Occasions", "Experiences", "Self drive"],
    image: media.fleetUrus,
    imageAlt: "Lamborghini Urus photographed at the workshop",
  },
  huracan: {
    id: "huracan",
    name: "Lamborghini Huracán",
    marque: "Lamborghini",
    line: "A statement car kept for select, pre-arranged journeys — arrivals, experiences and self-drive hire.",
    passengers: "1",
    luggage: "Cabin bag",
    availability: "Chauffeur or self-drive",
    rate: "On request",
    suited: ["Experiences", "Self drive", "Occasions"],
  },
  revuelto: {
    id: "revuelto",
    name: "Lamborghini Revuelto",
    marque: "Lamborghini",
    line: "Lamborghini's V12 flagship — reserved for pre-arranged experience journeys and self-drive by arrangement.",
    passengers: "1",
    luggage: "Cabin bag",
    availability: "Chauffeur or self-drive",
    rate: "On request",
    suited: ["Experiences", "Self drive"],
  },
};

export type FleetCategory = {
  id: string;
  index: string;
  /** Client's category names — do not rename or merge these. */
  title: string;
  summary: string;
  vehicles: readonly VehicleId[];
};

export const fleetCategories: readonly FleetCategory[] = [
  {
    id: "chauffeur-fleet",
    index: "I",
    title: "Chauffeur Fleet",
    summary: "The primary vehicles for executive and private chauffeur services.",
    vehicles: ["cullinan", "ghost", "flying-spur", "s-class", "range-rover", "v-class"],
  },
  {
    id: "high-profile-suvs",
    index: "II",
    title: "High-Profile SUVs",
    summary: "Commanding presence with exceptional comfort.",
    vehicles: ["range-rover", "g-wagon", "bentayga", "urus", "cullinan"],
  },
  {
    id: "group-transport",
    index: "III",
    title: "Group Transport",
    summary: "Executive group travel, kept to the same standard as the saloons.",
    vehicles: ["v-class-8", "v-class-jet"],
  },
  {
    id: "statement-experience",
    index: "IV",
    title: "Statement / Experience Vehicles",
    summary: "Available on request for select, pre-arranged journeys.",
    vehicles: ["huracan", "revuelto"],
  },
];

/** Vehicles shown on the homepage, where the photography is strongest. */
export const homepageVehicles: readonly VehicleId[] = [
  "cullinan",
  "g-wagon",
  "v-class-jet",
];

/** Self-drive and chauffeur-driven supercars. */
export const supercarIds: readonly VehicleId[] = ["huracan", "revuelto", "urus"];

export function getVehicle(id: VehicleId) {
  return vehicles[id];
}
