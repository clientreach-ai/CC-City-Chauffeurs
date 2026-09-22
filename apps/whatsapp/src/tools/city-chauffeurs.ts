/**
 * What the assistant can do.
 *
 * Deliberately few, and deliberately shaped like the website: it can read
 * what the website publishes, and it can ask for what the website lets any
 * visitor ask for. There is no tool to confirm a booking, quote a price,
 * check a car is free, or change or cancel anything — not because the model
 * is told not to, but because the tools do not exist.
 *
 * The two tools that create records take no journey at all. They build the
 * enquiry or booking request from the draft `record_journey_details` has
 * validated, so what reaches the office is what was checked, not whatever the
 * model chose to write at the last moment.
 */

import { z } from "zod";

import {
  helpfulToAsk,
  mergeJourney,
  missingFor,
  resolveVehicle,
  toRequestJourney,
} from "../conversation/journey";
import type { FleetVehicle, JourneyDraft } from "../ports";
import { defineTool, failure, success, type Tool, type ToolContext } from "./tool";

const nothing = z.object({}).strict();

function describeVehicle(vehicle: FleetVehicle) {
  return {
    name: vehicle.name,
    groupings: vehicle.groupings,
    description: vehicle.shortDescription,
    // `null` is information too: the client has not confirmed a figure.
    passengers: vehicle.passengers,
    luggage: vehicle.luggage || null,
    chauffeurDrivenOnly: vehicle.chauffeurOnly,
    indicativeHourlyRate: vehicle.hourlyRate,
    indicativeDayRate: vehicle.dayRate,
  };
}

const RATE_NOTE =
  "Rates are the indicative guides the website publishes, in pounds — never a quote. The final price is confirmed by the City Chauffeurs team. Where a figure is null the client has not confirmed it: say it is confirmed on enquiry.";

export const getFleet = defineTool({
  name: "get_fleet",
  description:
    "The current published City Chauffeurs fleet: every vehicle a customer can ask for, with its grouping, description, confirmed passenger and luggage figures, and the indicative rates the website publishes. Call this before saying anything about the fleet.",
  input: nothing,
  async run(context) {
    const { fleet } = await context.catalogue();
    return success({ vehicles: fleet.map(describeVehicle), note: RATE_NOTE });
  },
});

export const getVehicle = defineTool({
  name: "get_vehicle",
  description:
    "Details of one vehicle, found by what the customer called it — \"the Cullinan\", \"S Class\", \"a G-Wagon\". Says so when the name fits more than one vehicle, or none.",
  input: z.object({ vehicle: z.string().min(1).max(80).describe("What the customer called the vehicle.") }).strict(),
  async run(context, input) {
    const { fleet } = await context.catalogue();
    const match = resolveVehicle(input.vehicle, fleet);
    if ("vehicle" in match) return success({ vehicle: describeVehicle(match.vehicle), note: RATE_NOTE });
    if ("ambiguous" in match) {
      return failure("ambiguous", `That could be: ${match.ambiguous.map((vehicle) => vehicle.name).join(", ")}. Ask which one.`);
    }
    return failure("not_found", `No published vehicle matches. The fleet is: ${fleet.map((vehicle) => vehicle.name).join(", ")}.`);
  },
});

export const getServices = defineTool({
  name: "get_services",
  description: "Every chauffeur service City Chauffeurs offers, with a one-line summary of each. Call this before saying what the company does.",
  input: nothing,
  async run(context) {
    const { services } = await context.catalogue();
    return success({ services: services.map(({ name, summary }) => ({ name, summary })) });
  },
});

export const getService = defineTool({
  name: "get_service",
  description:
    "Full details of one service — what it includes, what the office needs to quote it, and which vehicles are offered for it.",
  input: z.object({ service: z.string().min(1).max(80).describe("The service's name, as listed by get_services.") }).strict(),
  async run(context, input) {
    const { services } = await context.catalogue();
    const key = input.service.toLowerCase().replace(/[^a-z0-9]/g, "");
    // Punctuation alone squashes to nothing, and every name "includes" nothing.
    const found = key && services.find(
      (service) =>
        service.slug === input.service ||
        service.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes(key),
    );
    if (!found) return failure("not_found", `No service matches. The services are: ${services.map((service) => service.name).join(", ")}.`);
    const detail = await context.backend.getService(found.slug);
    if (!detail) return failure("not_found", "That service is not currently offered.");
    return success({
      name: detail.name,
      summary: detail.summary,
      description: detail.standfirst,
      includes: detail.benefits.map((benefit) => `${benefit.title}: ${benefit.copy}`),
      toQuoteTheOfficeNeeds: detail.needs,
      vehicles: detail.vehicleNames,
    });
  },
});

/** Every field optional: the model reports what it has learned, as it learns it. */
const journeyInput = z
  .object({
    service: z.string().max(80).optional().describe("The service, by the name get_services lists."),
    vehicle: z.string().max(80).optional().describe("The vehicle as the customer named it — resolved to a real one."),
    pickup: z.string().max(160).optional().describe("Collection address, hotel or airport and terminal."),
    dropoff: z.string().max(160).optional().describe("Destination."),
    date: z.string().max(10).optional().describe("YYYY-MM-DD. Work out 'tomorrow' or 'Saturday' from today's date."),
    time: z.string().max(5).optional().describe("HH:MM, 24-hour clock."),
    passengers: z.number().int().optional(),
    luggage: z.string().max(120).optional(),
    flight: z.string().max(40).optional().describe("Flight number, for an airport collection."),
    notes: z.string().max(2000).optional().describe("Anything else the office should know."),
    name: z.string().max(80).optional().describe("The customer's name, as they gave it."),
    email: z.string().max(120).optional(),
  })
  .strict();

function summarise(draft: JourneyDraft, fleet: FleetVehicle[]) {
  const { vehicleId, ...rest } = draft;
  const vehicle = vehicleId ? fleet.find((item) => item.id === vehicleId)?.name : undefined;
  return { ...rest, ...(vehicle ? { vehicle } : {}) };
}

export const recordJourneyDetails = defineTool({
  name: "record_journey_details",
  description:
    "Record journey details as soon as the customer gives them — any subset, every time something new is said. Each value is checked: a vehicle is matched to the real fleet, a service to the real catalogue, a date must exist and not have passed. Returns what is now recorded, anything refused with the reason, and what is still needed.",
  input: journeyInput,
  async run(context, input) {
    const catalogue = await context.catalogue();
    const { draft, refused, notes } = mergeJourney(context.state.journey, input, catalogue);
    context.state.journey = draft;
    return success({
      recorded: summarise(draft, catalogue.fleet),
      refused,
      notes,
      stillNeededForEnquiry: missingFor("enquiry", draft),
      stillNeededForBookingRequest: missingFor("booking", draft),
      worthAsking: helpfulToAsk(draft),
    });
  },
});

/** Two requests from the same journey are one request. */
function fingerprint(draft: JourneyDraft) {
  return JSON.stringify(Object.entries(draft).sort(([a], [b]) => a.localeCompare(b)));
}

async function createRecord(context: ToolContext, kind: "enquiry" | "booking") {
  const draft = { ...context.state.journey, name: context.state.journey.name ?? context.customerName ?? undefined };
  const missing = missingFor(kind, draft);
  if (missing.length) {
    return failure("incomplete", `Still needed first: ${missing.join(", ")}. Ask the customer, then record it with record_journey_details.`);
  }

  const print = fingerprint(draft);
  const previous = context.state.lastRequest;
  if (previous && previous.kind === kind && previous.fingerprint === print) {
    // Asked again for the journey already recorded: the same reference, not a
    // second record for the office to spot as a duplicate.
    return success({ reference: previous.reference, alreadyRecorded: true });
  }

  const input = {
    customer: { name: draft.name!, phone: context.conversation.phone, email: draft.email ?? "" },
    journey: toRequestJourney(draft),
    // Derived from the message being answered: if this turn is ever run
    // again, the server finds the record it already made.
    submissionId: `wa:${context.triggeringMessageId}:${kind}`,
  };
  const { reference } =
    kind === "enquiry" ? await context.backend.createEnquiry(input) : await context.backend.createBookingRequest(input);

  context.state.lastRequest = { kind, fingerprint: print, reference };
  if (!context.state.references.includes(reference)) context.state.references.push(reference);
  context.createdFor = { reference };
  return success({ reference });
}

export const createEnquiry = defineTool({
  name: "create_enquiry",
  description:
    "Record an enquiry for the City Chauffeurs team from the journey details already recorded — for a customer who wants a price, or is not ready to fix a date. Only call it after summarising the details and the customer confirming. Returns the enquiry reference; give it to the customer exactly as returned.",
  input: nothing,
  run: (context) => createRecord(context, "enquiry"),
});

export const createBookingRequest = defineTool({
  name: "create_booking_request",
  description:
    "Record a booking request from the journey details already recorded — for a customer asking for a specific journey on a specific date. It is a request, not a booking: the team confirms the vehicle and chauffeur and comes back. Needs a date and a pickup. Only call it after summarising the details and the customer confirming. Returns the booking reference; give it exactly as returned.",
  input: nothing,
  run: (context) => createRecord(context, "booking"),
});

export const getEnquiryStatus = defineTool({
  name: "get_enquiry_status",
  description:
    "Where one of this customer's own enquiries stands, by its reference (ENQ-1234). Only enquiries made from this WhatsApp number can be found.",
  input: z.object({ reference: z.string().min(3).max(20).describe("The enquiry reference, e.g. ENQ-1105.") }).strict(),
  async run(context, input) {
    const found = await context.backend.findEnquiry(input.reference.trim().toUpperCase(), context.conversation.phone);
    // Another customer's reference answers exactly as one that does not exist.
    if (!found) return failure("not_found", "No enquiry with that reference was made from this number.");
    return success(found);
  },
});

export const handoffToHuman = defineTool({
  name: "handoff_to_human",
  description:
    "Hand the conversation to a person in the City Chauffeurs office. Use it when the customer asks for a person, has a complaint, an urgent or safety matter, a question about an existing booking you cannot answer, or anything else you cannot help with. After it, tell the customer a member of the team will reply here — and say nothing more.",
  input: z
    .object({
      reason: z.enum(["customer_asked", "complaint", "urgent", "existing_booking", "cannot_help", "other"]),
      summary: z.string().min(1).max(500).describe("One or two sentences for the person taking over: what the customer needs."),
    })
    .strict(),
  async run(context, input) {
    context.handoff = { reason: input.reason, summary: input.summary };
    return success({ handedOff: true });
  },
});

/** In name order, so the tool list is byte-identical on every request and the prompt cache holds. */
export const cityChauffeursTools: Tool[] = [
  createBookingRequest,
  createEnquiry,
  getEnquiryStatus,
  getFleet,
  getService,
  getServices,
  getVehicle,
  handoffToHuman,
  recordJourneyDetails,
].sort((a, b) => a.name.localeCompare(b.name));
