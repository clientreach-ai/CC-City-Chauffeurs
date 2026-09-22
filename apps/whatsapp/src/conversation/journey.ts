/**
 * The journey, as fields.
 *
 * The model hears "the S Class, three of us, Heathrow to Mayfair tomorrow at
 * eight" and passes the pieces to `record_journey_details`. This module
 * decides what each piece really is: the vehicle the customer named, resolved
 * to a real vehicle in the published fleet; the service, checked against the
 * real catalogue; the date, checked to be a day that exists and has not
 * passed. Anything that fails is refused with a reason the model can act on —
 * usually by asking the customer.
 *
 * The enquiry or booking request is built from what survived here and nothing
 * else, so the record the office reads is the record that was validated.
 */

import { PUBLIC_FORM_LIMITS } from "@CC-City-Chauffeurs/core";

import type { FleetVehicle, JourneyDraft, RequestJourney, ServiceSummary } from "../ports";

export type JourneyInput = {
  service?: string;
  vehicle?: string;
  pickup?: string;
  dropoff?: string;
  date?: string;
  time?: string;
  passengers?: number;
  luggage?: string;
  flight?: string;
  notes?: string;
  name?: string;
  email?: string;
};

export type Refusal = { field: keyof JourneyInput; reason: string };

export type Catalogue = {
  fleet: FleetVehicle[];
  services: ServiceSummary[];
  /** "YYYY-MM-DD", as the business sees today. */
  today: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Letters and digits only, lower case — "S-Class", "s class" and "SClass" all become "sclass". */
const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function isRealDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Which vehicle the customer meant, or why it cannot be said.
 *
 * An exact id or slug wins. Then a name that contains what they said,
 * ignoring punctuation and spacing: "S Class" finds the Mercedes S-Class,
 * "Cullinan" the Rolls-Royce. When what they said fits more than one car —
 * "a Rolls-Royce" is both the Cullinan and the Ghost — nothing is guessed;
 * the choices go back so the customer can be asked.
 */
export function resolveVehicle(
  said: string,
  fleet: FleetVehicle[],
): { vehicle: FleetVehicle } | { ambiguous: FleetVehicle[] } | { unknown: true } {
  // "The Cullinan", "a G-Wagon": the article is how people talk, not part of the name.
  const key = squash(said.trim().replace(/^(the|a|an)\s+/i, ""));
  if (!key) return { unknown: true };

  const exact = fleet.find(
    (vehicle) => vehicle.id === said || vehicle.slug === said || squash(vehicle.name) === key || squash(vehicle.model) === key,
  );
  if (exact) return { vehicle: exact };

  const partial = fleet.filter(
    (vehicle) => squash(vehicle.name).includes(key) || squash(`${vehicle.make}${vehicle.model}`).includes(key),
  );
  if (partial.length === 1) return { vehicle: partial[0]! };
  if (partial.length > 1) return { ambiguous: partial };
  return { unknown: true };
}

function resolveService(said: string, services: ServiceSummary[]): ServiceSummary | null {
  const key = squash(said);
  // Punctuation alone squashes to nothing, and every name "includes" nothing.
  if (!key) return null;
  return (
    services.find((service) => service.slug === said || squash(service.name) === key) ??
    services.find((service) => squash(service.name).includes(key) || squash(service.slug).includes(key)) ??
    null
  );
}

function capped(value: string, limit: number) {
  return value.trim().slice(0, limit);
}

/**
 * Folds what the model reported into the draft, keeping every value that
 * passes and refusing every value that does not. A refused value never
 * replaces a good one already held.
 */
export function mergeJourney(
  draft: JourneyDraft,
  input: JourneyInput,
  catalogue: Catalogue,
): { draft: JourneyDraft; refused: Refusal[]; notes: string[] } {
  const next: JourneyDraft = { ...draft };
  const refused: Refusal[] = [];
  const notes: string[] = [];

  if (input.vehicle !== undefined) {
    const match = resolveVehicle(input.vehicle, catalogue.fleet);
    if ("vehicle" in match) {
      next.vehicleId = match.vehicle.id;
      notes.push(`vehicle recorded as ${match.vehicle.name}`);
    } else if ("ambiguous" in match) {
      refused.push({
        field: "vehicle",
        reason: `"${input.vehicle}" could be any of: ${match.ambiguous.map((vehicle) => vehicle.name).join(", ")}. Ask which one.`,
      });
    } else {
      refused.push({
        field: "vehicle",
        reason: `No published vehicle matches "${input.vehicle}". The fleet is: ${catalogue.fleet.map((vehicle) => vehicle.name).join(", ")}.`,
      });
    }
  }

  if (input.service !== undefined) {
    const service = resolveService(input.service, catalogue.services);
    if (service) next.service = service.slug;
    else
      refused.push({
        field: "service",
        reason: `No service matches "${input.service}". The services are: ${catalogue.services.map((item) => item.name).join(", ")}.`,
      });
  }

  if (input.date !== undefined) {
    if (!isRealDate(input.date)) {
      refused.push({ field: "date", reason: "Give the date as YYYY-MM-DD, and a day that exists." });
    } else if (input.date < catalogue.today) {
      refused.push({ field: "date", reason: `That date has passed — today is ${catalogue.today}.` });
    } else {
      next.date = input.date;
    }
  }

  if (input.time !== undefined) {
    const time = input.time.trim();
    if (TIME.test(time)) next.time = time.padStart(5, "0");
    else refused.push({ field: "time", reason: "Give the time as HH:MM on the 24-hour clock, e.g. 20:00." });
  }

  if (input.passengers !== undefined) {
    if (Number.isInteger(input.passengers) && input.passengers >= 1 && input.passengers <= 50) {
      next.passengers = input.passengers;
      const car = next.vehicleId ? catalogue.fleet.find((vehicle) => vehicle.id === next.vehicleId) : undefined;
      // Said, not refused: the office can suggest another car, and the
      // capacity figures are the client's own to confirm.
      if (car?.passengers != null && input.passengers > car.passengers) {
        notes.push(`${car.name} is listed for ${car.passengers} passengers; the office will suggest a suitable vehicle`);
      }
    } else {
      refused.push({ field: "passengers", reason: "Passengers must be a whole number between 1 and 50." });
    }
  }

  if (input.email !== undefined) {
    const email = input.email.trim();
    if (email === "" || EMAIL.test(email)) next.email = capped(email, PUBLIC_FORM_LIMITS.email);
    else refused.push({ field: "email", reason: "That email address does not look complete." });
  }

  const text: [keyof JourneyInput & keyof JourneyDraft, number][] = [
    ["pickup", PUBLIC_FORM_LIMITS.pickup],
    ["dropoff", PUBLIC_FORM_LIMITS.dropoff],
    ["luggage", PUBLIC_FORM_LIMITS.luggage],
    ["flight", PUBLIC_FORM_LIMITS.flight],
    ["notes", PUBLIC_FORM_LIMITS.message],
    ["name", PUBLIC_FORM_LIMITS.name],
  ];
  for (const [field, limit] of text) {
    const value = input[field];
    if (typeof value !== "string") continue;
    const clean = capped(value, limit);
    if (clean) (next as Record<string, unknown>)[field] = clean;
  }

  return { draft: next, refused, notes };
}

/** What each kind of request still needs before it can be recorded. */
export function missingFor(kind: "enquiry" | "booking", draft: JourneyDraft): (keyof JourneyDraft)[] {
  const missing: (keyof JourneyDraft)[] = [];
  if (!draft.name) missing.push("name");
  if (kind === "booking") {
    // A booking is a row in the diary: it needs a day and a place to start.
    if (!draft.date) missing.push("date");
    if (!draft.pickup) missing.push("pickup");
  } else if (!draft.pickup && !draft.service && !draft.date && !draft.notes) {
    // An enquiry about nothing gives the office nothing to answer.
    missing.push("pickup");
  }
  return missing;
}

/** Worth asking for, but not worth refusing a request over. */
export function helpfulToAsk(draft: JourneyDraft): (keyof JourneyDraft)[] {
  const fields: (keyof JourneyDraft)[] = ["pickup", "dropoff", "date", "time", "passengers"];
  return fields.filter((field) => draft[field] === undefined);
}

export function toRequestJourney(draft: JourneyDraft): RequestJourney {
  return {
    service: draft.service ?? "",
    vehicleId: draft.vehicleId ?? null,
    pickup: draft.pickup ?? "",
    dropoff: draft.dropoff ?? "",
    date: draft.date ?? "",
    time: draft.time ?? "",
    passengers: draft.passengers ?? null,
    luggage: draft.luggage ?? "",
    flight: draft.flight ?? "",
    notes: draft.notes ?? "",
  };
}
