import { getDatabase, latency, newId, now } from "../store/database";
import type { PublishStatus, Service, ServiceInput } from "../types";
import { assertValid, CmsNotFoundError, SEO_LIMITS, validator, type FieldErrors } from "../validation";

/**
 * Services repository — the chauffeur service pages.
 *
 * Future API: GET/POST /services, GET/PATCH/DELETE /services/:id,
 * PUT /services/order.
 */

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

export async function getServices(): Promise<Service[]> {
  await latency("read");
  return getDatabase()
    .read("services")
    .sort((a, b) => a.position - b.position);
}

export async function getService(id: string): Promise<Service> {
  await latency("read");
  const service = getDatabase()
    .read("services")
    .find((item) => item.id === id);
  if (!service) throw new CmsNotFoundError("This service");
  return service;
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

export async function createService(input: ServiceInput): Promise<Service> {
  await latency("write");
  const db = getDatabase();
  const services = db.read("services");
  assertValid(validateService(input, services));
  const stamp = now();
  const service: Service = {
    ...structuredClone(input),
    id: newId("svc"),
    position: services.length,
    createdAt: stamp,
    updatedAt: stamp,
    publishedAt: input.status === "published" ? stamp : null,
  };
  db.write((draft) => {
    draft.services.push(service);
  });
  return service;
}

export async function updateService(id: string, input: ServiceInput): Promise<Service> {
  await latency("write");
  const db = getDatabase();
  const services = db.read("services");
  const current = services.find((item) => item.id === id);
  if (!current) throw new CmsNotFoundError("This service");
  assertValid(validateService(input, services.filter((item) => item.id !== id)));
  const stamp = now();
  const next: Service = {
    ...current,
    ...structuredClone(input),
    id,
    position: current.position,
    updatedAt: stamp,
    publishedAt:
      input.status === "published" ? (current.status === "published" ? current.publishedAt : stamp) : current.publishedAt,
  };
  db.write((draft) => {
    draft.services = draft.services.map((item) => (item.id === id ? next : item));
  });
  return next;
}

export async function setServiceStatus(id: string, status: PublishStatus) {
  const current = await getService(id);
  return updateService(id, { ...current, status });
}

export async function reorderServices(ids: string[]): Promise<void> {
  await latency("write");
  getDatabase().write((draft) => {
    for (const service of draft.services) {
      const position = ids.indexOf(service.id);
      if (position >= 0) service.position = position;
    }
  });
}

export async function getServiceUsage(id: string) {
  await latency("read");
  const db = getDatabase();
  return {
    onHomepage: db
      .read("homepage")
      .some((section) => section.kind === "services" && section.serviceIds.includes(id)),
    photographs: db.read("gallery").filter((item) => item.serviceIds.includes(id)).length,
    testimonials: db.read("testimonials").filter((item) => item.serviceId === id).length,
  };
}

export async function deleteService(id: string): Promise<void> {
  await latency("write");
  const db = getDatabase();
  if (!db.read("services").some((item) => item.id === id)) throw new CmsNotFoundError("This service");
  db.write((draft) => {
    draft.services = draft.services
      .filter((item) => item.id !== id)
      .sort((a, b) => a.position - b.position)
      .map((item, position) => ({ ...item, position }));
    for (const section of draft.homepage) {
      if (section.kind === "services") section.serviceIds = section.serviceIds.filter((s) => s !== id);
    }
    for (const item of draft.gallery) item.serviceIds = item.serviceIds.filter((s) => s !== id);
    for (const item of draft.testimonials) if (item.serviceId === id) item.serviceId = null;
  });
}
