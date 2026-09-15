import {
  assertValid,
  CmsNotFoundError,
  validateService,
  type PublishStatus,
  type Service,
  type ServiceInput,
} from "@CC-City-Chauffeurs/core";
import { db, schema } from "@CC-City-Chauffeurs/db";
import { asc, eq, inArray, sql } from "drizzle-orm";

import { iso, isoOrNull, newId } from "../lib/ids";

/**
 * The chauffeur service pages.
 *
 * Routes: GET/POST /services, GET/PATCH/DELETE /services/:id,
 * PUT /services/order.
 */

type ServiceRow = typeof schema.service.$inferSelect;

function toService(row: ServiceRow, vehicleIds: string[]): Service {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    headline: row.headline,
    summary: row.summary,
    standfirst: row.standfirst,
    heroImage: row.heroImage ?? null,
    facts: row.facts,
    benefits: row.benefits,
    detail: row.detail,
    gallery: row.gallery,
    vehicleIds,
    booking: row.booking,
    enquiry: row.enquiry,
    seo: row.seo,
    template: row.template,
    position: row.position,
    status: row.status,
    publishedAt: isoOrNull(row.publishedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function vehicleIdsByService(serviceIds?: string[]) {
  const rows = await db
    .select()
    .from(schema.serviceVehicle)
    .where(serviceIds ? inArray(schema.serviceVehicle.serviceId, serviceIds) : undefined)
    .orderBy(asc(schema.serviceVehicle.position));
  const index = new Map<string, string[]>();
  for (const row of rows) {
    const list = index.get(row.serviceId) ?? [];
    list.push(row.vehicleId);
    index.set(row.serviceId, list);
  }
  return (id: string) => index.get(id) ?? [];
}

export async function getServices(): Promise<Service[]> {
  const rows = await db.select().from(schema.service).orderBy(asc(schema.service.position));
  const vehicles = await vehicleIdsByService();
  return rows.map((row) => toService(row, vehicles(row.id)));
}

export async function getService(id: string): Promise<Service> {
  const [row] = await db.select().from(schema.service).where(eq(schema.service.id, id)).limit(1);
  if (!row) throw new CmsNotFoundError("This service");
  const vehicles = await vehicleIdsByService([id]);
  return toService(row, vehicles(id));
}

function serviceColumns(input: ServiceInput) {
  return {
    slug: input.slug,
    name: input.name,
    headline: input.headline,
    summary: input.summary,
    standfirst: input.standfirst,
    heroImage: input.heroImage,
    facts: input.facts,
    benefits: input.benefits,
    detail: input.detail,
    gallery: input.gallery,
    booking: input.booking,
    enquiry: input.enquiry,
    seo: input.seo,
    template: input.template,
    status: input.status,
  };
}

/** Replaces the offered vehicles, keeping the order they were sent in. */
async function setVehicles(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  serviceId: string,
  vehicleIds: string[],
) {
  await tx.delete(schema.serviceVehicle).where(eq(schema.serviceVehicle.serviceId, serviceId));
  if (!vehicleIds.length) return;
  await tx
    .insert(schema.serviceVehicle)
    .values(vehicleIds.map((vehicleId, position) => ({ serviceId, vehicleId, position })))
    .onConflictDoNothing();
}

export async function createService(input: ServiceInput): Promise<Service> {
  const services = await getServices();
  assertValid(validateService(input, services));
  const id = newId("svc");
  await db.transaction(async (tx) => {
    await tx.insert(schema.service).values({
      id,
      ...serviceColumns(input),
      position: services.length,
      publishedAt: input.status === "published" ? new Date() : null,
    });
    await setVehicles(tx, id, input.vehicleIds);
  });
  return getService(id);
}

export async function updateService(id: string, input: ServiceInput): Promise<Service> {
  const services = await getServices();
  const current = services.find((item) => item.id === id);
  if (!current) throw new CmsNotFoundError("This service");
  assertValid(validateService(input, services.filter((item) => item.id !== id)));

  await db.transaction(async (tx) => {
    await tx
      .update(schema.service)
      .set({
        ...serviceColumns(input),
        publishedAt:
          input.status === "published" && current.status !== "published"
            ? new Date()
            : current.publishedAt
              ? new Date(current.publishedAt)
              : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.service.id, id));
    await setVehicles(tx, id, input.vehicleIds);
  });
  return getService(id);
}

export async function setServiceStatus(id: string, status: PublishStatus) {
  const current = await getService(id);
  return updateService(id, { ...current, status });
}

export async function reorderServices(ids: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx.update(schema.service).set({ position }).where(eq(schema.service.id, id));
    }
  });
}

export async function getServiceUsage(id: string) {
  const [homepage, photographs, testimonials] = await Promise.all([
    db.select().from(schema.homepageSection).where(eq(schema.homepageSection.kind, "services")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.galleryItemService)
      .where(eq(schema.galleryItemService.serviceId, id)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.testimonial)
      .where(eq(schema.testimonial.serviceId, id)),
  ]);

  return {
    onHomepage: homepage.some((section) =>
      ((section.data as { serviceIds?: string[] }).serviceIds ?? []).includes(id),
    ),
    photographs: Number(photographs[0]?.count ?? 0),
    testimonials: Number(testimonials[0]?.count ?? 0),
  };
}

export async function deleteService(id: string): Promise<void> {
  const [row] = await db.select().from(schema.service).where(eq(schema.service.id, id)).limit(1);
  if (!row) throw new CmsNotFoundError("This service");

  await db.transaction(async (tx) => {
    // Junction rows and the testimonial's reference go with it; the homepage
    // keeps ids in a document, so it is cleaned here.
    const featured = await tx
      .select()
      .from(schema.homepageSection)
      .where(eq(schema.homepageSection.kind, "services"));
    for (const section of featured) {
      const data = section.data as { serviceIds?: string[] };
      if (!data.serviceIds?.includes(id)) continue;
      await tx
        .update(schema.homepageSection)
        .set({ data: { ...data, serviceIds: data.serviceIds.filter((item) => item !== id) } })
        .where(eq(schema.homepageSection.id, section.id));
    }

    await tx.delete(schema.service).where(eq(schema.service.id, id));

    const rest = await tx.select().from(schema.service).orderBy(asc(schema.service.position));
    for (const [position, service] of rest.entries()) {
      await tx.update(schema.service).set({ position }).where(eq(schema.service.id, service.id));
    }
  });
}
