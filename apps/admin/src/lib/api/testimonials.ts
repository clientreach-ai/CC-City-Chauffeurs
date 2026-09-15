import type { PublishStatus, Testimonial, TestimonialInput } from "@CC-City-Chauffeurs/core";

import { api } from "./client";

export { validateTestimonial } from "@CC-City-Chauffeurs/core";

export async function getTestimonials() {
  return api.get<Testimonial[]>("/testimonials");
}

export function emptyTestimonial(): TestimonialInput {
  return {
    quote: "",
    firstName: "",
    role: "",
    district: "",
    serviceId: null,
    date: "",
    permission: false,
    status: "draft",
  };
}

export async function createTestimonial(input: TestimonialInput) {
  return api.post<Testimonial>("/testimonials", input);
}

export async function updateTestimonial(id: string, input: TestimonialInput) {
  return api.patch<Testimonial>(`/testimonials/${id}`, input);
}

export async function setTestimonialStatus(id: string, status: PublishStatus) {
  return api.patch<Testimonial>(`/testimonials/${id}/status`, { status });
}

export async function reorderTestimonials(ids: string[]) {
  return api.put<void>("/testimonials/order", { ids });
}

export async function deleteTestimonial(id: string) {
  return api.delete<void>(`/testimonials/${id}`);
}
