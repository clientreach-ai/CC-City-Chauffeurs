/**
 * Fake reviews are enforceable under the Digital Markets, Competition and
 * Consumers Act 2024, so publishing is gated on the details that make a quote
 * attributable — and on a record that the customer agreed to it.
 */
import type { TestimonialInput } from "../types";
import { validator, type FieldErrors } from "../validation";


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
