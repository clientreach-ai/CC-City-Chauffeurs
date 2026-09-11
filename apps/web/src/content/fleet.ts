import { media } from "./media";
import type { StaticImageData } from "next/image";

/**
 * The fleet — twelve vehicles, as confirmed on the client intake
 * (PRD Appendix B).
 *
 * The four groupings below are the client's own and must not be renamed or
 * merged. Vehicles deliberately appear in more than one grouping where the
 * client lists them twice: the Cullinan and Range Rover are both core
 * chauffeur cars and high-profile SUVs, and the Mercedes V-Class (8 seats) is
 * both a core chauffeur car and group transport.
 *
 * Indicative hourly rates come from the client intake: Cullinan £200,
 * Urus £150, G-Wagon £125, S-Class £90, V-Class £75. Everything else reads
 * "On request" rather than being guessed at.
 *
 * Capacity is shown only where the client has given it (PRD §10.7):
 * Cullinan 3 / 2 large cases, S-Class 3 / 2, V-Class 6 / 5. Everything else
 * is left undefined and renders as "On enquiry" — a standard-configuration
 * figure is not a City Chauffeurs specification.
 *
 * Still with the client (PRD §17 Q4):
 *  - capacities for the remaining nine vehicles;
 *  - photography — the Cullinan, G-Wagon and Urus are photographed, everything
 *    else renders as a typographic plate (see `VehiclePlate`);
 *  - the Ferrari SF90 and Rolls-Royce Wraith appear in the client's
 *    photography but not on the fleet list, so they are gallery-only.
 */

export type VehicleId =
  | "cullinan"
  | "ghost"
  | "flying-spur"
  | "s-class"
  | "range-rover"
  | "v-class"
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
  /** Client-confirmed only. Leave undefined rather than estimate. */
  passengers?: string;
  /** Client-confirmed only. Leave undefined rather than estimate. */
  luggage?: string;
  availability: "Chauffeur-driven" | "Chauffeur or self-drive";
  rate: string;
  /** Which services this vehicle is typically used for. */
  suited: readonly string[];
  image?: StaticImageData;
  imageAlt?: string;
};

/** What to print where the client has not confirmed a capacity. */
export const UNCONFIRMED = "On enquiry";

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
    availability: "Chauffeur-driven",
    rate: "On request",
    suited: ["Weddings", "Private clients", "Occasions"],
  },
  "flying-spur": {
    id: "flying-spur",
    name: "Bentley Flying Spur",
    marque: "Bentley",
    line: "British luxury with a long-distance temperament — composed at speed, unhurried in traffic.",
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
    availability: "Chauffeur-driven",
    rate: "On request",
    suited: ["Airport transfers", "Family travel", "Corporate"],
  },
  "v-class": {
    id: "v-class",
    name: "Mercedes V-Class",
    marque: "Mercedes-Benz",
    line: "The eight-seat V-Class — everyone arrives together, with room for the luggage.",
    passengers: "6",
    luggage: "5 cases",
    availability: "Chauffeur-driven",
    rate: "From £75 / hour",
    suited: ["Groups", "Airport transfers", "Weddings"],
  },
  "v-class-jet": {
    id: "v-class-jet",
    name: "Mercedes V-Class JetClass",
    marque: "Mercedes-Benz",
    line: "A four-seat lounge conversion — a meeting room that happens to be moving.",
    availability: "Chauffeur-driven",
    rate: "On request",
    suited: ["Roadshows", "Corporate", "Long distance"],
    // No photograph: the only JetClass image available was a converter's
    // marketing shot, not the client's vehicle. Renders as a plate until real
    // photography arrives.
  },
  "g-wagon": {
    id: "g-wagon",
    name: "Mercedes G-Wagon",
    marque: "Mercedes-AMG",
    line: "Distinctive, secure and high-profile — the squared silhouette that commands every street it occupies.",
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
    availability: "Chauffeur-driven",
    rate: "On request",
    suited: ["Weddings", "Corporate", "City to city"],
  },
  urus: {
    id: "urus",
    name: "Lamborghini Urus",
    marque: "Lamborghini",
    line: "Performance-led luxury SUV for statement journeys, chauffeur-driven or self-drive by arrangement.",
    availability: "Chauffeur or self-drive",
    rate: "From £150 / hour",
    suited: ["Occasions", "Experiences", "Self drive"],
    image: media.fleetUrus,
    imageAlt: "Lamborghini Urus in purple, photographed in the workshop",
  },
  huracan: {
    id: "huracan",
    name: "Lamborghini Huracán",
    marque: "Lamborghini",
    line: "A two-seat statement car kept for select, pre-arranged journeys — arrivals, experiences and self-drive hire.",
    availability: "Chauffeur or self-drive",
    rate: "On request",
    suited: ["Experiences", "Self drive", "Occasions"],
  },
  revuelto: {
    id: "revuelto",
    name: "Lamborghini Revuelto",
    marque: "Lamborghini",
    line: "Lamborghini's two-seat V12 flagship — reserved for pre-arranged experience journeys and self-drive by arrangement.",
    availability: "Chauffeur or self-drive",
    rate: "On request",
    suited: ["Experiences", "Self drive"],
  },
};

/** "3 passengers" when the client has confirmed it, a plain placeholder when not. */
export function passengersLabel(vehicle: Vehicle) {
  return vehicle.passengers
    ? `${vehicle.passengers} passengers`
    : `Capacity ${UNCONFIRMED.toLowerCase()}`;
}

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
    vehicles: ["v-class", "v-class-jet"],
  },
  {
    id: "statement-experience",
    index: "IV",
    title: "Statement / Experience Vehicles",
    summary: "Available on request for select, pre-arranged journeys.",
    vehicles: ["huracan", "revuelto"],
  },
];

/** Every vehicle once, in fleet order — twelve, per the client intake. */
export const fleetVehicles: readonly Vehicle[] = Object.values(vehicles);

/** Vehicles shown on the homepage — the ones the client has photographed. */
export const homepageVehicles: readonly VehicleId[] = ["cullinan", "g-wagon", "urus"];

/** Self-drive and chauffeur-driven supercars. */
export const supercarIds: readonly VehicleId[] = ["huracan", "revuelto", "urus"];

export function getVehicle(id: VehicleId) {
  return vehicles[id];
}
