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

import { classifyLocation, journeyDateRefusal, PUBLIC_FORM_LIMITS } from "@CC-City-Chauffeurs/core";

import type {
  EnquiryOption,
  FleetVehicle,
  JourneyDraft,
  JourneyRules,
  RequestJourney,
  ServiceSummary,
} from "../ports";

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
  /** The client's published booking terms, in their own words. */
  terms: string[];
  /**
   * What the website's enquiry form offers beyond the published services —
   * self-drive supercar hire, a supercar experience, "something else". The
   * business takes these; it just does not publish a page for them.
   */
  options: EnquiryOption[];
  /** "YYYY-MM-DD", as the business sees today. */
  today: string;
  /** Where we drive and how far ahead we take work, from the client's settings. */
  rules: JourneyRules;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Where a place the customer named is judged, and what each answer means here. */
const PLACE_FIELDS = ["pickup", "dropoff"] as const;

/** Letters and digits only, lower case — "S-Class", "s class" and "SClass" all become "sclass". */
const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

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

/** A service the customer can ask for, whether or not it has a page. */
type Offered = { slug: string; name: string };

/**
 * Everything on offer, published pages first.
 *
 * The enquiry form's list repeats the nine services under friendlier labels
 * ("Wedding" for "Weddings"), so a published service wins where both match
 * and the extras are what the pages do not cover.
 */
export function everythingOffered(catalogue: Pick<Catalogue, "services" | "options">): Offered[] {
  const offered = new Map<string, Offered>();
  for (const service of catalogue.services) offered.set(service.slug, { slug: service.slug, name: service.name });
  for (const option of catalogue.options) {
    if (!offered.has(option.value)) offered.set(option.value, { slug: option.value, name: option.label });
  }
  return [...offered.values()];
}

export function resolveService(said: string, catalogue: Pick<Catalogue, "services" | "options">): Offered | null {
  const key = squash(said);
  // Punctuation alone squashes to nothing, and every name "includes" nothing.
  if (!key) return null;
  const offered = everythingOffered(catalogue);
  return (
    offered.find((service) => service.slug === said || squash(service.name) === key) ??
    offered.find((service) => squash(service.name).includes(key) || squash(service.slug).includes(key)) ??
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
    const service = resolveService(input.service, catalogue);
    if (service) next.service = service.slug;
    else
      refused.push({
        field: "service",
        reason: `Nothing we offer matches "${input.service}". We offer: ${everythingOffered(catalogue).map((item) => item.name).join(", ")}.`,
      });
  }

  if (input.date !== undefined) {
    // One rule, shared with the server: a day that exists, not one that has
    // gone, and not one so far off that it is a mistyped year. No grace
    // here — an assistant told "yesterday" should ask again rather than
    // quietly take it.
    const refusal = journeyDateRefusal(input.date, {
      today: catalogue.today,
      maxMonthsAhead: catalogue.rules.maxMonthsAhead,
    });
    if (refusal) refused.push({ field: "date", reason: refusal });
    else next.date = input.date;
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

  /**
   * A pick-up or a destination, judged against where we actually drive.
   *
   * Three answers, and the middle one is why this is not a simple refusal.
   * Somewhere we cover is recorded. A country we do not cover is refused,
   * named, and never written down — which is what stops an enquiry to El
   * Salvador reaching the office. Anywhere unrecognised is recorded and
   * flagged: a customer in a village nobody listed must not be turned away,
   * but the assistant is told to confirm whereabouts it is, because the
   * server will refuse it if the answer turns out to be abroad.
   */
  const weDoNotGoThere = new Set<string>();
  for (const field of PLACE_FIELDS) {
    const said = input[field];
    if (typeof said !== "string" || !said.trim()) continue;
    const verdict = classifyLocation(said, catalogue.rules.coverage);
    if (verdict.outcome === "outside") {
      refused.push({
        field,
        reason: `We do not cover ${verdict.named}. We drive in London, across the UK and in Europe. Tell the customer that plainly and ask whether there is a UK or European ${field === "pickup" ? "pick-up" : "destination"} instead.`,
      });
      weDoNotGoThere.add(field);
    } else if (verdict.outcome === "unclear") {
      notes.push(
        `"${said.trim()}" is not a place we have listed. It is recorded, but check whereabouts it is before recording the enquiry: if it is outside the UK and Europe we cannot take it.`,
      );
    }
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
    // A place we do not drive to was refused above and is never written
    // down, so a good value already held is not replaced by it either.
    if (weDoNotGoThere.has(field)) continue;
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
