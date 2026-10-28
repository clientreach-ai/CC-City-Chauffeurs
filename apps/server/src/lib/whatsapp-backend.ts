import {
  bookingStatuses,
  CmsValidationError,
  company,
  enquiryStatuses,
  labelFor,
  type Enquiry,
  type Service,
  type Vehicle,
} from "@CC-City-Chauffeurs/core";
import { publicEnquirySchema } from "@CC-City-Chauffeurs/core/schemas";
import {
  type Backend,
  BackendValidationError,
  type EnquiryStatusSummary,
  type FleetVehicle,
  type RequestCustomer,
  type ServiceDetail,
  type ServiceSummary,
} from "@CC-City-Chauffeurs/whatsapp/ports";
import { ZodError } from "zod";

import { enquiryRecorded } from "./notifications";
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
 * An enquiry as the assistant is allowed to see it.
 *
 * The journey, the note and any recorded quote, plus whether the customer
 * may still change it and why not — answered by the same rule the mutation
 * itself applies, so the assistant never offers a change the server is
 * about to refuse. The vehicle is a name rather than an id: the customer
 * asked for a Ghost, not for `veh-ghost`.
 */
function toEnquirySummary(enquiry: Enquiry, vehicleName: (id: string | null) => string | null): EnquiryStatusSummary {
  const blocked = operations.settledReason({ status: enquiry.status, bookingId: enquiry.bookingId });
  return {
    reference: enquiry.reference,
    status: labelFor(enquiryStatuses, enquiry.status),
    changeable: blocked === null,
    ...(blocked ? { notChangeableBecause: blocked } : {}),
    journey: {
      service: enquiry.journey.service,
      vehicle: vehicleName(enquiry.journey.vehicleId),
      pickup: enquiry.journey.pickup,
      dropoff: enquiry.journey.dropoff,
      date: enquiry.journey.date,
      time: enquiry.journey.time,
      passengers: enquiry.journey.passengers,
      luggage: enquiry.journey.luggage,
      flight: enquiry.journey.flight,
    },
    note: enquiry.message,
    quote: enquiry.quote ? { amount: enquiry.quote.amount, note: enquiry.quote.note } : null,
    createdAt: enquiry.createdAt,
    updatedAt: enquiry.updatedAt,
  };
}

/**
 * Vehicle names by id, including cars no longer published: an enquiry is a
 * record of what was asked for, and a car withdrawn from the website since
 * does not make the customer's own enquiry unreadable.
 */
async function vehicleNamer() {
  const vehicles = await fleet.getVehicles();
  const names = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.name]));
  return (id: string | null) => (id ? (names.get(id) ?? null) : null);
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

    /** The same terms the website prints beside every service's quote brief. */
    async listBookingTerms() {
      // Worth saying, not worth failing a conversation over.
      const settings = await content.getSettings().catch(() => null);
      return [...(settings?.booking.terms ?? [])];
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
        bookingNote: service.booking.note,
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
     * Reading your own enquiry, wherever it came from. The website's form and
     * WhatsApp both belong to the person whose number is on them, and being
     * told the state of your own enquiry is not a change to it.
     */
    async findEnquiry(reference, phone) {
      const enquiry = await operations.enquiryForPhone(reference, phone);
      return enquiry ? toEnquirySummary(enquiry, await vehicleNamer()) : null;
    },

    async listMyEnquiries(phone) {
      const [enquiries, nameOf] = await Promise.all([operations.whatsappEnquiriesForPhone(phone), vehicleNamer()]);
      return enquiries.map((enquiry) => toEnquirySummary(enquiry, nameOf));
    },

    /**
     * Changing one, which is a different permission from reading one, so it
     * goes through the source-aware lookup rather than the general one.
     */
    async updateMyEnquiry(reference, phone, patch) {
      const enquiry = await operations.whatsappEnquiryForPhone(reference, phone);
      if (!enquiry) return null;
      return refusalsAsBackendErrors(async () =>
        toEnquirySummary(await operations.updateEnquiryJourney(enquiry.id, patch), await vehicleNamer()),
      );
    },

    async cancelMyEnquiry(reference, phone) {
      const enquiry = await operations.whatsappEnquiryForPhone(reference, phone);
      if (!enquiry) return null;
      return refusalsAsBackendErrors(async () =>
        toEnquirySummary(await operations.cancelEnquiry(enquiry.id, "customer"), await vehicleNamer()),
      );
    },

    /** What the client publishes about itself, from the settings they edit. */
    async companyInfo() {
      const settings = await content.getSettings();
      return {
        name: settings.business.companyName,
        legalName: settings.business.legalName,
        registeredName: company.registeredName,
        companyNumber: company.number,
        registeredOffice: company.registeredOffice,
        positioning: settings.business.positioning,
        tagline: settings.business.tagline,
        base: settings.business.base,
        coverage: settings.business.coverage,
        serviceAreas: [...settings.business.serviceAreas],
        phone: settings.contact.phoneDisplay,
        whatsapp: settings.contact.whatsappDisplay,
        email: settings.contact.email,
        website: settings.seo.siteUrl,
        bookingTerms: [...settings.booking.terms],
        // Nothing in the settings publishes a timetable and the website
        // prints none, so empty is the honest answer. What the assistant
        // says in its place is in the prompt, not invented here.
        openingHours: "",
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
