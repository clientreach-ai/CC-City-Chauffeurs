import type {
  Booking,
  BookingStatus,
  Customer,
  CustomerInput,
  CustomerSummary,
  Enquiry,
  EnquiryStatus,
  ImageRef,
  LostReason,
  PublishStatus,
  Vehicle,
  VehicleOwnership,
  VehiclePricing,
  VehicleSpecs,
} from "@CC-City-Chauffeurs/core";

import { api } from "./client";

/**
 * Enquiries, bookings and customers.
 *
 * Everything here records and nothing sends: a status change, a note or a
 * quote is written to the book of record and no further. The screens say so
 * beside every action a real dispatch system would follow through on.
 */

export async function getEnquiries() {
  return api.get<Enquiry[]>("/enquiries");
}

export async function getEnquiry(id: string) {
  return api.get<Enquiry>(`/enquiries/${id}`);
}

export async function updateEnquiryStatus(
  id: string,
  status: EnquiryStatus,
  options: { lostReason?: LostReason } = {},
) {
  return api.patch<Enquiry>(`/enquiries/${id}/status`, { status, ...options });
}

export async function recordQuote(id: string, quote: { amount: number | null; note: string }) {
  return api.post<Enquiry>(`/enquiries/${id}/quote`, quote);
}

export async function addEnquiryNote(id: string, body: string, author?: string) {
  return api.post<Enquiry>(`/enquiries/${id}/notes`, { body, author });
}

/** Turns a won enquiry into a pending booking carrying the same journey. */
export async function createBookingFromEnquiry(id: string) {
  return api.post<Booking>(`/enquiries/${id}/booking`);
}

export async function getBookings() {
  return api.get<Booking[]>("/bookings");
}

export async function getBooking(id: string) {
  return api.get<Booking>(`/bookings/${id}`);
}

export async function updateBookingStatus(id: string, status: BookingStatus) {
  return api.patch<Booking>(`/bookings/${id}/status`, { status });
}

export async function updateBookingNotes(id: string, notes: string) {
  return api.patch<Booking>(`/bookings/${id}/notes`, { notes });
}

export async function getCustomers() {
  return api.get<CustomerSummary[]>("/customers");
}

export async function getCustomer(id: string) {
  return api.get<{ customer: CustomerSummary; enquiries: Enquiry[]; bookings: Booking[] }>(
    `/customers/${id}`,
  );
}

export async function updateCustomer(id: string, input: CustomerInput) {
  return api.patch<Customer>(`/customers/${id}`, input);
}

// ------------------------------------------------------------------ overview

/** A vehicle as the dashboard needs it — the fields it actually prints. */
type OverviewVehicle = {
  id: string;
  name: string;
  status: PublishStatus;
  images: { main: ImageRef | null; gallery: ImageRef[] };
  specs: VehicleSpecs;
  pricing: VehiclePricing;
  ownership: VehicleOwnership;
};

/**
 * Everything the dashboard shows, in one call. Every figure is a count of
 * real records; nothing is projected, estimated or financial.
 */
export type Overview = {
  pipeline: { value: EnquiryStatus; label: string; note: string; count: number }[];
  unanswered: Enquiry[];
  recent: Enquiry[];
  upcoming: Booking[];
  customers: CustomerSummary[];
  vehicles: OverviewVehicle[];
  content: {
    vehicles: { published: number; draft: number; archived: number };
    services: { published: number; draft: number };
    gallery: { published: number; hidden: number };
    testimonials: { published: number; pending: number };
  };
  gaps: {
    photography: { id: string; name: string }[];
    capacity: { id: string; name: string }[];
    ownership: number;
    pricing: number;
  };
};

export async function getOverview() {
  return api.get<Overview>("/overview");
}

export type { Vehicle };
