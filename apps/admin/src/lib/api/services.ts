import type { PublishStatus, Service, ServiceInput } from "@CC-City-Chauffeurs/core";

import { api } from "./client";

export { validateService } from "@CC-City-Chauffeurs/core";

/** The chauffeur service pages. */

export async function getServices() {
  return api.get<Service[]>("/services");
}

export async function getService(id: string) {
  return api.get<Service>(`/services/${id}`);
}

export function emptyService(): ServiceInput {
  return {
    slug: "",
    name: "",
    headline: [],
    summary: "",
    standfirst: "",
    heroImage: null,
    facts: [],
    benefits: [],
    detail: { heading: "", paragraphs: [], image: null },
    gallery: [],
    vehicleIds: [],
    booking: { needs: [], note: "" },
    enquiry: { heading: "", ctaLabel: "Request a quote" },
    seo: { title: "", description: "" },
    template: "index",
    status: "draft",
  };
}

export async function createService(input: ServiceInput) {
  return api.post<Service>("/services", input);
}

export async function updateService(id: string, input: ServiceInput) {
  return api.patch<Service>(`/services/${id}`, input);
}

export async function setServiceStatus(id: string, status: PublishStatus) {
  return api.patch<Service>(`/services/${id}/status`, { status });
}

export async function reorderServices(ids: string[]) {
  return api.put<void>("/services/order", { ids });
}

export type ServiceUsage = { onHomepage: boolean; photographs: number; testimonials: number };

export async function getServiceUsage(id: string) {
  return api.get<ServiceUsage>(`/services/${id}/usage`);
}

export async function deleteService(id: string) {
  return api.delete<void>(`/services/${id}`);
}
