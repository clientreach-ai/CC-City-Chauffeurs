import { getDatabase, latency, newId, now } from "../store/database";
import type { PublishStatus, Testimonial, TestimonialInput } from "../types";
import { assertValid, CmsNotFoundError, validator, type FieldErrors } from "../validation";

/**
 * Testimonials repository.
 *
 * Fake reviews are enforceable under the Digital Markets, Competition and
 * Consumers Act 2024 (PRD §4.3), so publishing is gated on the details that
 * make a quote attributable: first name, role, district — and a record that
 * the customer agreed to it being published.
 *
 * Future API: GET/POST /testimonials, PATCH/DELETE /testimonials/:id,
 * PUT /testimonials/order.
 */

export function validateTestimonial(input: TestimonialInput): FieldErrors {
  const v = validator()
    .required("quote", input.quote, "Add the customer's words.")
    .maxLength("quote", input.quote, 600)
    .maxLength("firstName", input.firstName, 30)
    .custom("firstName", /\s/.test(input.firstName.trim()), "First name only — surnames are not published.")
    .maxLength("role", input.role, 50)
    .maxLength("district", input.district, 40);

  if (input.status === "published") {
    v.required("firstName", input.firstName, "A published testimonial needs the customer's first name.")
      .required("role", input.role, "Add the customer's role, e.g. “Bride” or “Executive assistant”.")
      .required("district", input.district, "Add the customer's district, e.g. “Mayfair”.")
      .custom("permission", !input.permission, "Confirm the customer agreed to this being published.");
  }
  return v.result();
}

export async function getTestimonials(): Promise<Testimonial[]> {
  await latency("read");
  return getDatabase()
    .read("testimonials")
    .sort((a, b) => a.position - b.position);
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

export async function createTestimonial(input: TestimonialInput): Promise<Testimonial> {
  await latency("write");
  assertValid(validateTestimonial(input));
  const db = getDatabase();
  const stamp = now();
  const testimonial: Testimonial = {
    ...structuredClone(input),
    id: newId("tst"),
    position: db.read("testimonials").length,
    createdAt: stamp,
    updatedAt: stamp,
  };
  db.write((draft) => {
    draft.testimonials.push(testimonial);
  });
  return testimonial;
}

export async function updateTestimonial(id: string, input: TestimonialInput): Promise<Testimonial> {
  await latency("write");
  assertValid(validateTestimonial(input));
  const db = getDatabase();
  const current = db.read("testimonials").find((item) => item.id === id);
  if (!current) throw new CmsNotFoundError("This testimonial");
  const next: Testimonial = { ...current, ...structuredClone(input), updatedAt: now() };
  db.write((draft) => {
    draft.testimonials = draft.testimonials.map((item) => (item.id === id ? next : item));
  });
  return next;
}

export async function setTestimonialStatus(id: string, status: PublishStatus) {
  await latency("read");
  const current = getDatabase()
    .read("testimonials")
    .find((item) => item.id === id);
  if (!current) throw new CmsNotFoundError("This testimonial");
  return updateTestimonial(id, { ...current, status });
}

export async function reorderTestimonials(ids: string[]): Promise<void> {
  await latency("write");
  getDatabase().write((draft) => {
    for (const item of draft.testimonials) {
      const position = ids.indexOf(item.id);
      if (position >= 0) item.position = position;
    }
  });
}

export async function deleteTestimonial(id: string): Promise<void> {
  await latency("write");
  getDatabase().write((draft) => {
    draft.testimonials = draft.testimonials
      .filter((item) => item.id !== id)
      .sort((a, b) => a.position - b.position)
      .map((item, position) => ({ ...item, position }));
  });
}
