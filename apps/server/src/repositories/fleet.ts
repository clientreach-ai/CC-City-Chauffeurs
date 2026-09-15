import {
  assertValid,
  CmsNotFoundError,
  slugify,
  uniqueSlug,
  validator,
  validateCategory,
  validateVehicle,
  type FleetCategory,
  type FleetCategoryInput,
  type PublishStatus,
  type Vehicle,
  type VehicleFeature,
  type VehicleInput,
  type Visibility,
} from "@CC-City-Chauffeurs/core";
import { db, schema } from "@CC-City-Chauffeurs/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { ConflictError } from "../lib/errors";
import { iso, isoOrNull, newId } from "../lib/ids";

/**
 * Fleet — vehicles, the groupings they appear in, and the feature list.
 *
 * Routes: GET/POST /vehicles, GET/PATCH/DELETE /vehicles/:id,
 * POST /vehicles/:id/duplicate, GET/POST/PATCH /fleet-categories, GET /features.
 *
 * A vehicle's relationships are stored once each, on the side that orders
 * them: `vehicle_category` carries the order the fleet page prints a grouping
 * in, `service_vehicle` the order a service page lists its cars in. Both are
 * read back onto the vehicle here so a caller sees one whole record.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

// ------------------------------------------------------------------ mapping

type VehicleRow = typeof schema.vehicle.$inferSelect;

function toVehicle(
  row: VehicleRow,
  links: { categoryIds: string[]; serviceIds: string[]; featureIds: string[] },
): Vehicle {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    make: row.make,
    model: row.model,
    categoryIds: links.categoryIds,
    shortDescription: row.shortDescription,
    description: row.description,
    specs: row.specs,
    availability: row.availability,
    ownership: row.ownership,
    featureIds: links.featureIds,
    serviceIds: links.serviceIds,
    suitedTags: row.suitedTags,
    pricing: row.pricing,
    images: row.images,
    seo: row.seo,
    status: row.status,
    publishedAt: isoOrNull(row.publishedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

/** Every vehicle's links, in one pass — lists must not query per row. */
async function linksFor(tx: Db, vehicleIds?: string[]) {
  const [categories, services, features] = await Promise.all([
    tx
      .select()
      .from(schema.vehicleCategory)
      .where(vehicleIds ? inArray(schema.vehicleCategory.vehicleId, vehicleIds) : undefined),
    tx
      .select()
      .from(schema.serviceVehicle)
      .where(vehicleIds ? inArray(schema.serviceVehicle.vehicleId, vehicleIds) : undefined)
      .orderBy(asc(schema.serviceVehicle.position)),
    tx
      .select()
      .from(schema.vehicleFeatureLink)
      .where(vehicleIds ? inArray(schema.vehicleFeatureLink.vehicleId, vehicleIds) : undefined),
  ]);

  const index = new Map<string, { categoryIds: string[]; serviceIds: string[]; featureIds: string[] }>();
  const bucket = (id: string) => {
    let entry = index.get(id);
    if (!entry) {
      entry = { categoryIds: [], serviceIds: [], featureIds: [] };
      index.set(id, entry);
    }
    return entry;
  };
  for (const row of categories) bucket(row.vehicleId).categoryIds.push(row.categoryId);
  for (const row of services) bucket(row.vehicleId).serviceIds.push(row.serviceId);
  for (const row of features) bucket(row.vehicleId).featureIds.push(row.featureId);
  return (id: string) => index.get(id) ?? { categoryIds: [], serviceIds: [], featureIds: [] };
}

// ------------------------------------------------------------------ vehicles

export async function getVehicles(): Promise<Vehicle[]> {
  const rows = await db.select().from(schema.vehicle).orderBy(asc(schema.vehicle.name));
  const links = await linksFor(db);
  return rows.map((row) => toVehicle(row, links(row.id)));
}

export async function getVehicle(id: string): Promise<Vehicle> {
  const [row] = await db.select().from(schema.vehicle).where(eq(schema.vehicle.id, id)).limit(1);
  if (!row) throw new CmsNotFoundError("This vehicle");
  const links = await linksFor(db, [id]);
  return toVehicle(row, links(id));
}

/**
 * Writes both sides of a vehicle's relationships.
 *
 * Membership is added at the end of a grouping and removed cleanly; the
 * existing order of everything else is left exactly as it was, because
 * reordering is a separate, deliberate action.
 */
async function syncRelations(
  tx: Tx,
  vehicleId: string,
  categoryIds: string[],
  serviceIds: string[],
  featureIds: string[],
) {
  const existingCategories = await tx
    .select()
    .from(schema.vehicleCategory)
    .where(eq(schema.vehicleCategory.vehicleId, vehicleId));
  const have = new Set(existingCategories.map((row) => row.categoryId));

  const removedCategories = existingCategories
    .filter((row) => !categoryIds.includes(row.categoryId))
    .map((row) => row.categoryId);
  if (removedCategories.length) {
    await tx
      .delete(schema.vehicleCategory)
      .where(
        and(
          eq(schema.vehicleCategory.vehicleId, vehicleId),
          inArray(schema.vehicleCategory.categoryId, removedCategories),
        ),
      );
  }
  for (const categoryId of categoryIds) {
    if (have.has(categoryId)) continue;
    const [{ next } = { next: 0 }] = await tx
      .select({ next: sql<number>`coalesce(max(${schema.vehicleCategory.position}) + 1, 0)` })
      .from(schema.vehicleCategory)
      .where(eq(schema.vehicleCategory.categoryId, categoryId));
    await tx
      .insert(schema.vehicleCategory)
      .values({ vehicleId, categoryId, position: Number(next) })
      .onConflictDoNothing();
  }

  const existingServices = await tx
    .select()
    .from(schema.serviceVehicle)
    .where(eq(schema.serviceVehicle.vehicleId, vehicleId));
  const offered = new Set(existingServices.map((row) => row.serviceId));

  const removedServices = existingServices
    .filter((row) => !serviceIds.includes(row.serviceId))
    .map((row) => row.serviceId);
  if (removedServices.length) {
    await tx
      .delete(schema.serviceVehicle)
      .where(
        and(
          eq(schema.serviceVehicle.vehicleId, vehicleId),
          inArray(schema.serviceVehicle.serviceId, removedServices),
        ),
      );
  }
  for (const serviceId of serviceIds) {
    if (offered.has(serviceId)) continue;
    const [{ next } = { next: 0 }] = await tx
      .select({ next: sql<number>`coalesce(max(${schema.serviceVehicle.position}) + 1, 0)` })
      .from(schema.serviceVehicle)
      .where(eq(schema.serviceVehicle.serviceId, serviceId));
    await tx
      .insert(schema.serviceVehicle)
      .values({ serviceId, vehicleId, position: Number(next) })
      .onConflictDoNothing();
  }

  await tx.delete(schema.vehicleFeatureLink).where(eq(schema.vehicleFeatureLink.vehicleId, vehicleId));
  if (featureIds.length) {
    await tx
      .insert(schema.vehicleFeatureLink)
      .values(featureIds.map((featureId) => ({ vehicleId, featureId })))
      .onConflictDoNothing();
  }
}

/** The columns a vehicle's editable fields map to. */
function vehicleColumns(input: VehicleInput) {
  return {
    slug: input.slug,
    name: input.name,
    make: input.make,
    model: input.model,
    shortDescription: input.shortDescription,
    description: input.description,
    specs: input.specs,
    availability: input.availability,
    ownership: input.ownership,
    suitedTags: input.suitedTags,
    pricing: input.pricing,
    images: input.images,
    seo: input.seo,
    status: input.status,
  };
}

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  const existing = await getVehicles();
  assertValid(validateVehicle(input, existing));

  const id = newId("veh");
  await db.transaction(async (tx) => {
    await tx.insert(schema.vehicle).values({
      id,
      ...vehicleColumns(input),
      publishedAt: input.status === "published" ? new Date() : null,
    });
    await syncRelations(tx, id, input.categoryIds, input.serviceIds, input.featureIds);
  });
  return getVehicle(id);
}

export async function updateVehicle(id: string, input: VehicleInput): Promise<Vehicle> {
  const all = await getVehicles();
  const current = all.find((item) => item.id === id);
  if (!current) throw new CmsNotFoundError("This vehicle");
  assertValid(validateVehicle(input, all.filter((item) => item.id !== id)));

  await db.transaction(async (tx) => {
    await tx
      .update(schema.vehicle)
      .set({
        ...vehicleColumns(input),
        // First publish stamps the date; later edits keep the original.
        publishedAt:
          input.status === "published" && current.status !== "published"
            ? new Date()
            : current.publishedAt
              ? new Date(current.publishedAt)
              : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.vehicle.id, id));
    await syncRelations(tx, id, input.categoryIds, input.serviceIds, input.featureIds);
  });
  return getVehicle(id);
}

export async function setVehicleStatus(id: string, status: PublishStatus): Promise<Vehicle> {
  const current = await getVehicle(id);
  return updateVehicle(id, { ...current, status });
}

export async function duplicateVehicle(id: string): Promise<Vehicle> {
  const source = await getVehicle(id);
  const taken = new Set((await getVehicles()).map((item) => item.slug));
  return createVehicle({
    ...source,
    name: `${source.name} (copy)`,
    slug: uniqueSlug(`${source.slug}-copy`, taken),
    status: "draft",
  });
}

/** What deleting this vehicle would touch — shown in the confirmation. */
export async function getVehicleUsage(id: string) {
  const [categories, services, homepage, photographs] = await Promise.all([
    db
      .select({ title: schema.fleetCategory.title })
      .from(schema.vehicleCategory)
      .innerJoin(schema.fleetCategory, eq(schema.fleetCategory.id, schema.vehicleCategory.categoryId))
      .where(eq(schema.vehicleCategory.vehicleId, id)),
    db
      .select({ name: schema.service.name })
      .from(schema.serviceVehicle)
      .innerJoin(schema.service, eq(schema.service.id, schema.serviceVehicle.serviceId))
      .where(eq(schema.serviceVehicle.vehicleId, id)),
    db.select().from(schema.homepageSection).where(eq(schema.homepageSection.kind, "fleet")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.galleryItem)
      .where(eq(schema.galleryItem.vehicleId, id)),
  ]);

  return {
    categories: categories.map((row) => row.title),
    services: services.map((row) => row.name),
    onHomepage: homepage.some((section) =>
      ((section.data as { vehicleIds?: string[] }).vehicleIds ?? []).includes(id),
    ),
    photographs: Number(photographs[0]?.count ?? 0),
  };
}

export async function deleteVehicle(id: string): Promise<void> {
  const [row] = await db.select().from(schema.vehicle).where(eq(schema.vehicle.id, id)).limit(1);
  if (!row) throw new CmsNotFoundError("This vehicle");

  await db.transaction(async (tx) => {
    // Junction rows and the gallery's reference go with it (the schema's own
    // cascade and set-null rules); the homepage keeps a copy of the id in a
    // document, so it is cleaned here.
    const featured = await tx
      .select()
      .from(schema.homepageSection)
      .where(eq(schema.homepageSection.kind, "fleet"));
    for (const section of featured) {
      const data = section.data as { vehicleIds?: string[] };
      if (!data.vehicleIds?.includes(id)) continue;
      await tx
        .update(schema.homepageSection)
        .set({ data: { ...data, vehicleIds: data.vehicleIds.filter((item) => item !== id) } })
        .where(eq(schema.homepageSection.id, section.id));
    }
    await tx.delete(schema.vehicle).where(eq(schema.vehicle.id, id));
    // Enquiries and bookings keep the id — they are history, and the screens
    // say "no longer listed" rather than quietly changing what was agreed.
  });
}

export function suggestSlug(name: string) {
  return slugify(name);
}

// ------------------------------------------------------------------ features

export async function getFeatures(): Promise<VehicleFeature[]> {
  return db.select().from(schema.vehicleFeature).orderBy(asc(schema.vehicleFeature.position));
}

export async function createFeature(label: string, note = ""): Promise<VehicleFeature> {
  assertValid(
    validator().required("label", label, "Name the feature.").maxLength("label", label, 40).result(),
  );
  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${schema.vehicleFeature.position}) + 1, 0)` })
    .from(schema.vehicleFeature);
  const feature: VehicleFeature = {
    id: newId("feat"),
    label: label.trim(),
    note: note.trim(),
    position: Number(next),
  };
  await db.insert(schema.vehicleFeature).values(feature);
  return feature;
}

// ------------------------------------------------------------------ categories

type CategoryRow = typeof schema.fleetCategory.$inferSelect;

function toCategory(row: CategoryRow, vehicleOrder: string[]): FleetCategory {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    position: row.position,
    status: row.status,
    vehicleOrder,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function getCategories(): Promise<FleetCategory[]> {
  const [rows, members] = await Promise.all([
    db.select().from(schema.fleetCategory).orderBy(asc(schema.fleetCategory.position)),
    db.select().from(schema.vehicleCategory).orderBy(asc(schema.vehicleCategory.position)),
  ]);
  const order = new Map<string, string[]>();
  for (const row of members) {
    const list = order.get(row.categoryId) ?? [];
    list.push(row.vehicleId);
    order.set(row.categoryId, list);
  }
  return rows.map((row) => toCategory(row, order.get(row.id) ?? []));
}

export async function createCategory(input: FleetCategoryInput): Promise<FleetCategory> {
  const categories = await getCategories();
  assertValid(validateCategory(input, categories));
  const id = newId("cat");
  await db.insert(schema.fleetCategory).values({ ...input, id, position: categories.length });
  return (await getCategories()).find((item) => item.id === id)!;
}

export async function updateCategory(id: string, input: FleetCategoryInput): Promise<FleetCategory> {
  const categories = await getCategories();
  const current = categories.find((item) => item.id === id);
  if (!current) throw new CmsNotFoundError("This grouping");
  assertValid(validateCategory(input, categories.filter((item) => item.id !== id)));
  await db
    .update(schema.fleetCategory)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.fleetCategory.id, id));
  return (await getCategories()).find((item) => item.id === id)!;
}

export async function setCategoryStatus(id: string, status: Visibility) {
  const current = (await getCategories()).find((item) => item.id === id);
  if (!current) throw new CmsNotFoundError("This grouping");
  return updateCategory(id, {
    title: current.title,
    slug: current.slug,
    summary: current.summary,
    status,
  });
}

export async function reorderCategories(ids: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx
        .update(schema.fleetCategory)
        .set({ position })
        .where(eq(schema.fleetCategory.id, id));
    }
  });
}

/** Reorders members only — membership is changed from the vehicle editor. */
export async function reorderCategoryVehicles(id: string, vehicleOrder: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    const members = await tx
      .select()
      .from(schema.vehicleCategory)
      .where(eq(schema.vehicleCategory.categoryId, id));
    if (!members.length) throw new CmsNotFoundError("This grouping");
    const known = new Set(members.map((row) => row.vehicleId));
    const ordered = vehicleOrder.filter((vehicleId) => known.has(vehicleId));
    for (const [position, vehicleId] of ordered.entries()) {
      await tx
        .update(schema.vehicleCategory)
        .set({ position })
        .where(
          and(
            eq(schema.vehicleCategory.categoryId, id),
            eq(schema.vehicleCategory.vehicleId, vehicleId),
          ),
        );
    }
    await tx
      .update(schema.fleetCategory)
      .set({ updatedAt: new Date() })
      .where(eq(schema.fleetCategory.id, id));
  });
}

/**
 * A grouping with vehicles in it cannot be deleted: its vehicles would drop
 * off the fleet page without anyone deciding that they should.
 */
export async function deleteCategory(id: string): Promise<void> {
  const [row] = await db
    .select()
    .from(schema.fleetCategory)
    .where(eq(schema.fleetCategory.id, id))
    .limit(1);
  if (!row) throw new CmsNotFoundError("This grouping");

  const members = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.vehicleCategory)
    .where(eq(schema.vehicleCategory.categoryId, id));
  const count = Number(members[0]?.count ?? 0);
  if (count) {
    throw new ConflictError(
      `Move ${count === 1 ? "its vehicle" : `its ${count} vehicles`} to another grouping first.`,
    );
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.fleetCategory).where(eq(schema.fleetCategory.id, id));
    const rest = await tx
      .select()
      .from(schema.fleetCategory)
      .orderBy(asc(schema.fleetCategory.position));
    for (const [position, category] of rest.entries()) {
      await tx
        .update(schema.fleetCategory)
        .set({ position })
        .where(eq(schema.fleetCategory.id, category.id));
    }
  });
}
