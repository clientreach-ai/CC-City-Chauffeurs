import {
  bookingStatuses,
  CmsValidationError,
  enquiryStatuses,
  labelFor,
  type Service,
  type Vehicle,
} from "@CC-City-Chauffeurs/core";
import { bookingInputSchema, publicEnquirySchema } from "@CC-City-Chauffeurs/core/schemas";
import {
  type Backend,
  BackendValidationError,
  type FleetVehicle,
  type RequestCustomer,
  type RequestJourney,
  type ServiceDetail,
  type ServiceSummary,
} from "@CC-City-Chauffeurs/whatsapp/ports";
import { ZodError } from "zod";

import { bookingRequested, enquiryRecorded } from "./notifications";
import * as content from "../repositories/content";
import * as fleet from "../repositories/fleet";
import * as operations from "../repositories/operations";
import * as services from "../repositories/services";

/**
 * What the WhatsApp assistant may ask of City Chauffeurs, answered by the
 * same repositories the website and the admin use.
 *
 * Nothing here decides anything. The fleet is the published fleet the
 * website shows; an enquiry is the enquiry the website's form makes, run
 * through the website's own schema; a booking request is a booking the diary
 * already knows how to hold, marked as a request. The only work done here is
 * translation between the channel's shapes and the domain's — so there is one
 * set of rules for matching a customer or numbering an enquiry, whichever
 * door the customer came through.
 */

const published = <T extends { status: string }>(rows: T[]) =>
  rows.filter((row) => row.status === "published");

/**
 * The journey's own names for the fields the domain calls something else, so
 * a refusal points at the field the assistant actually filled in.
 */
const JOURNEY_FIELD: Record<string, string> = { message: "notes" };

function fieldsOf(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "request";
    const name = JOURNEY_FIELD[path] ?? path;
    fields[name] ??= issue.message;
  }
  return fields;
}

/**
 * Runs `attempt`, turning the domain's refusals into the channel's. The
 * messages are the server's own — the same ones the website form shows a
 * visitor — so they are safe to pass on to the customer.
 */
async function refusalsAsBackendErrors<T>(attempt: () => Promise<T>): Promise<T> {
  try {
    return await attempt();
  } catch (error) {
    if (error instanceof ZodError) throw new BackendValidationError(fieldsOf(error));
    if (error instanceof CmsValidationError) {
      const fields: Record<string, string> = {};
      for (const [name, message] of Object.entries(error.fields)) {
        if (message) fields[JOURNEY_FIELD[name] ?? name] = message;
      }
      throw new BackendValidationError(fields);
    }
    throw error;
  }
}

function toFleetVehicle(vehicle: Vehicle, groupings: Map<string, string>): FleetVehicle {
  return {
    id: vehicle.id,
    slug: vehicle.slug,
    name: vehicle.name,
    make: vehicle.make,
    model: vehicle.model,
    groupings: vehicle.categoryIds
      .map((id) => groupings.get(id))
      .filter((title): title is string => title != null),
    shortDescription: vehicle.shortDescription,
    passengers: vehicle.specs.passengers ?? null,
    luggage: vehicle.specs.luggage,
    chauffeurOnly: vehicle.availability === "chauffeur",
    hourlyRate: vehicle.pricing.hourlyRate ?? null,
    dayRate: vehicle.pricing.dayRate ?? null,
  };
}

const toSummary = (service: Service): ServiceSummary => ({
  slug: service.slug,
  name: service.name,
  summary: service.summary,
});

/**
 * Luggage and a flight number have their own fields on an enquiry but not on
 * a booking. Written into the notes rather than dropped, because the office
 * needs both to plan the journey.
 */
function bookingNotes(journey: RequestJourney) {
  return [
    journey.notes.trim(),
    journey.luggage.trim() && `Luggage: ${journey.luggage.trim()}`,
    journey.flight.trim() && `Flight: ${journey.flight.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function createWhatsAppBackend(): Backend {
  return {
    async listFleet() {
      const [vehicles, categories] = await Promise.all([fleet.getVehicles(), fleet.getCategories()]);
      // A grouping still in draft is not something the website has said yet.
      const groupings = new Map(published(categories).map((category) => [category.id, category.title]));
      return published(vehicles).map((vehicle) => toFleetVehicle(vehicle, groupings));
    },

    async listServices() {
      return published(await services.getServices()).map(toSummary);
    },

    /** The same list the website's enquiry form shows a visitor. */
    async listEnquiryOptions() {
      return content.getEnquiryServices();
    },

    async getService(slug): Promise<ServiceDetail | null> {
      const [serviceRows, vehicles] = await Promise.all([services.getServices(), fleet.getVehicles()]);
      const service = published(serviceRows).find((item) => item.slug === slug);
      if (!service) return null;

      // In the order the service page lists them, and only those still live.
      const live = new Map(published(vehicles).map((vehicle) => [vehicle.id, vehicle.name]));
      return {
        ...toSummary(service),
        standfirst: service.standfirst,
        benefits: service.benefits.map(({ title, copy }) => ({ title, copy })),
        needs: [...service.booking.needs],
        vehicleNames: service.vehicleIds
          .map((id) => live.get(id))
          .filter((name): name is string => name != null),
      };
    },

    /**
     * The website's enquiry, made on WhatsApp. Parsed by the website form's
     * own schema, so every rule the form is held to — a real date, not in the
     * past, sensible lengths — holds here too; nothing is written unless it
     * passes.
     */
    async createEnquiry({ customer, journey, submissionId }) {
      return refusalsAsBackendErrors(async () => {
        const input = publicEnquirySchema.parse({
          ...contactOf(customer),
          replyBy: "whatsapp",
          service: journey.service,
          vehicleId: journey.vehicleId,
          pickup: journey.pickup,
          dropoff: journey.dropoff,
          date: journey.date,
          time: journey.time,
          passengers: journey.passengers,
          luggage: journey.luggage,
          flight: journey.flight,
          message: journey.notes,
          // The honeypot. A person on WhatsApp never fills it in.
          website: "",
        });
        // Added after parsing: the schema caps a browser's id at 64
        // characters, and this one is the channel's own, not the visitor's.
        const enquiry = await operations.createPublicEnquiry(
          { ...input, submissionId },
          { source: "whatsapp" },
        );
        // The office hears about it the same way it hears about the website's.
        enquiryRecorded(enquiry);
        return { reference: enquiry.reference };
      });
    },

    /**
     * A booking request: pending until the office confirms it. Parsed by the
     * same schema as a booking the office takes, so it needs a real date; the
     * repository then records it as a request whatever the status says.
     */
    async createBookingRequest({ customer, journey, submissionId }) {
      return refusalsAsBackendErrors(async () => {
        const input = bookingInputSchema.parse({
          ...contactOf(customer),
          service: journey.service,
          vehicleId: journey.vehicleId,
          date: journey.date,
          time: journey.time,
          pickup: journey.pickup,
          dropoff: journey.dropoff,
          passengers: journey.passengers,
          notes: bookingNotes(journey),
          status: "pending",
        });
        const booking = await operations.createBooking(input, {
          request: { channel: "whatsapp", submissionId },
        });
        bookingRequested(booking, contactOf(customer));
        return { reference: booking.reference };
      });
    },

    async findEnquiry(reference, phone) {
      const enquiry = await operations.enquiryForPhone(reference, phone);
      if (!enquiry) return null;
      return {
        reference: enquiry.reference,
        status: labelFor(enquiryStatuses, enquiry.status),
        createdAt: enquiry.createdAt,
      };
    },

    /**
     * Where a booking stands. `confirmed` is the whole point: a request the
     * office has not agreed to yet must never read as a booking, however the
     * status happens to be labelled.
     */
    async findBooking(reference, phone) {
      const booking = await operations.bookingForPhone(reference, phone);
      if (!booking) return null;
      const vehicles = booking.vehicleId ? await fleet.getVehicles() : [];
      return {
        reference: booking.reference,
        status: labelFor(bookingStatuses, booking.status),
        confirmed: booking.status !== "pending" && booking.status !== "cancelled",
        date: booking.date,
        time: booking.time,
        pickup: booking.pickup,
        dropoff: booking.destination,
        vehicle: vehicles.find((vehicle) => vehicle.id === booking.vehicleId)?.name ?? null,
      };
    },

    async matchCustomer(phone) {
      const customer = await operations.customerMatch(phone, "");
      return customer ? { id: customer.id, name: customer.name } : null;
    },
  };
}

/**
 * The number is the one WhatsApp delivered from, in E.164. Customer matching
 * compares the last ten digits, so it already finds a customer the office
 * wrote down as `07700 900321`.
 */
const contactOf = (customer: RequestCustomer) => ({
  name: customer.name,
  phone: customer.phone,
  email: customer.email,
});
