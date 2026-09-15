/**
 * What may be saved, and what may be published, for the fleet.
 *
 * The admin form runs these as you type and the API runs them again on
 * write, so a rule is written once and cannot be bypassed by calling the
 * API directly.
 */
import type { FleetCategory, FleetCategoryInput, Vehicle, VehicleInput } from "../types";
import { SEO_MAX, validator, type FieldErrors } from "../validation";


/** The next free slug in a family, for "Name (copy)". */
export function uniqueSlug(base: string, taken: Set<string>) {
  let slug = base || "vehicle";
  let n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;
  return slug;
}

/**
 * Rules for saving. A draft needs only a name and a usable slug; publishing
 * needs everything the public fleet page prints.
 */
export function validateVehicle(input: VehicleInput, others: Vehicle[]): FieldErrors {
  const v = validator()
    .required("name", input.name, "Give the vehicle a name.")
    .maxLength("name", input.name, 60)
    .required("slug", input.slug, "A slug is needed for the vehicle's web address.")
    .slug("slug", input.slug)
    .custom("slug", others.some((other) => other.slug === input.slug), "Another vehicle already uses this slug.")
    .maxLength("shortDescription", input.shortDescription, 220)
    .integer("specs.passengers", input.specs.passengers, 1, 60)
    .integer("specs.year", input.specs.year, 1950, new Date().getFullYear() + 1)
    .amount("pricing.hourlyRate", input.pricing.hourlyRate)
    .amount("pricing.dayRate", input.pricing.dayRate)
    .maxLength("seo.title", input.seo.title, SEO_MAX.title)
    .maxLength("seo.description", input.seo.description, SEO_MAX.description);

  if (input.status === "published") {
    v.required("make", input.make, "Add the make before publishing.")
      .required("shortDescription", input.shortDescription, "Add a short description before publishing.")
      .required("categoryIds", input.categoryIds, "Choose at least one fleet grouping before publishing.")
      .custom(
        "images.main",
        input.images.main != null && !input.images.main.alt.trim(),
        "Describe the main image (alt text) before publishing.",
      );
  }

  return v.result();
}

export function validateCategory(input: FleetCategoryInput, others: FleetCategory[]) {
  return validator()
    .required("title", input.title, "Name the grouping.")
    .maxLength("title", input.title, 50)
    .required("slug", input.slug)
    .slug("slug", input.slug)
    .custom("slug", others.some((other) => other.slug === input.slug), "Another grouping already uses this slug.")
    .maxLength("summary", input.summary, 160)
    .result();
}
