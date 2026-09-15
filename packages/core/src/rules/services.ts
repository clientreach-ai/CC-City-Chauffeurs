/** What may be saved, and what may be published, for a service page. */
import type { Service, ServiceInput } from "../types";
import { SEO_LIMITS, validator, type FieldErrors } from "../validation";


export function validateService(input: ServiceInput, others: Service[]): FieldErrors {
  const v = validator()
    .required("name", input.name, "Name the service.")
    .maxLength("name", input.name, 40)
    .required("slug", input.slug, "A slug is needed for the page address.")
    .slug("slug", input.slug)
    .custom("slug", others.some((other) => other.slug === input.slug), "Another service already uses this slug.")
    .maxLength("summary", input.summary, 200)
    .maxLength("seo.title", input.seo.title, SEO_LIMITS.title)
    .maxLength("seo.description", input.seo.description, SEO_LIMITS.description)
    .custom(
      "headline",
      input.headline.some((line) => line.length > 24),
      "Keep each headline line short — under 24 characters — so it sets well in display type.",
    );

  if (input.status === "published") {
    v.required("headline", input.headline.filter((line) => line.trim()), "Add the page headline before publishing.")
      .required("summary", input.summary, "Add a short description before publishing.")
      .required("standfirst", input.standfirst, "Add the opening paragraph before publishing.")
      .required("heroImage", input.heroImage, "Choose a hero image before publishing.")
      .custom(
        "heroImage",
        input.heroImage != null && !input.heroImage.alt.trim(),
        "Describe the hero image (alt text) before publishing.",
      )
      .required("benefits", input.benefits, "Add at least one key benefit before publishing.")
      .required("seo.title", input.seo.title, "Add an SEO title before publishing.")
      .required("seo.description", input.seo.description, "Add an SEO description before publishing.");
  }

  return v.result();
}
