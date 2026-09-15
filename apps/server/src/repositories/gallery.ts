import {
  assertValid,
  CmsNotFoundError,
  validateGalleryItem,
  type GalleryItem,
  type GalleryItemInput,
  type ImageRef,
  type Visibility,
} from "@CC-City-Chauffeurs/core";
import { db, schema } from "@CC-City-Chauffeurs/db";
import { asc, eq, inArray, sql } from "drizzle-orm";

import { iso, newId } from "../lib/ids";

/**
 * The photographs on /gallery.
 *
 * Routes: GET/POST /gallery, PATCH/DELETE /gallery/:id,
 * PATCH /gallery (bulk status), PUT /gallery/order.
 */

type GalleryRow = typeof schema.galleryItem.$inferSelect;

function toItem(row: GalleryRow, serviceIds: string[]): GalleryItem {
  return {
    id: row.id,
    image: row.image,
    caption: row.caption,
    location: row.location,
    vehicleId: row.vehicleId,
    row: row.rowId,
    category: row.category,
    serviceIds,
    position: row.position,
    status: row.status,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function serviceIdsByItem(itemIds?: string[]) {
  const rows = await db
    .select()
    .from(schema.galleryItemService)
    .where(itemIds ? inArray(schema.galleryItemService.galleryItemId, itemIds) : undefined);
  const index = new Map<string, string[]>();
  for (const row of rows) {
    const list = index.get(row.galleryItemId) ?? [];
    list.push(row.serviceId);
    index.set(row.galleryItemId, list);
  }
  return (id: string) => index.get(id) ?? [];
}

export async function getGallery(): Promise<GalleryItem[]> {
  const rows = await db.select().from(schema.galleryItem).orderBy(asc(schema.galleryItem.position));
  const services = await serviceIdsByItem();
  return rows.map((row) => toItem(row, services(row.id)));
}

export async function getGalleryRows() {
  const rows = await db.select().from(schema.galleryRow).orderBy(asc(schema.galleryRow.position));
  return rows.map((row) => ({ id: row.id, label: row.label }));
}

/**
 * Adds freshly uploaded photographs as hidden drafts at the end of the
 * gallery. They are not public until someone describes and publishes them.
 */
export async function addGalleryImages(
  images: ImageRef[],
  defaults: Pick<GalleryItemInput, "row" | "category" | "vehicleId">,
): Promise<GalleryItem[]> {
  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${schema.galleryItem.position}) + 1, 0)` })
    .from(schema.galleryItem);

  const values = images.map((image, i) => ({
    id: newId("gal"),
    image,
    caption: "",
    location: "",
    vehicleId: defaults.vehicleId,
    rowId: defaults.row,
    category: defaults.category,
    position: Number(next) + i,
    status: "draft" as const,
  }));

  await db.insert(schema.galleryItem).values(values);
  const ids = values.map((value) => value.id);
  const rows = await db.select().from(schema.galleryItem).where(inArray(schema.galleryItem.id, ids));
  return rows.map((row) => toItem(row, []));
}

export async function updateGalleryItem(
  id: string,
  input: GalleryItemInput,
): Promise<GalleryItem> {
  const errors = validateGalleryItem(input);
  if (input.status === "published" && !input.image.alt.trim()) {
    errors["image.alt"] ??= "Describe the photograph before publishing it.";
  }
  assertValid(errors);

  const [current] = await db
    .select()
    .from(schema.galleryItem)
    .where(eq(schema.galleryItem.id, id))
    .limit(1);
  if (!current) throw new CmsNotFoundError("This photograph");

  await db.transaction(async (tx) => {
    await tx
      .update(schema.galleryItem)
      .set({
        image: input.image,
        caption: input.caption,
        location: input.location,
        vehicleId: input.vehicleId,
        rowId: input.row,
        category: input.category,
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(schema.galleryItem.id, id));

    await tx
      .delete(schema.galleryItemService)
      .where(eq(schema.galleryItemService.galleryItemId, id));
    if (input.serviceIds.length) {
      await tx
        .insert(schema.galleryItemService)
        .values(input.serviceIds.map((serviceId) => ({ galleryItemId: id, serviceId })))
        .onConflictDoNothing();
    }
  });

  const [row] = await db
    .select()
    .from(schema.galleryItem)
    .where(eq(schema.galleryItem.id, id))
    .limit(1);
  const services = await serviceIdsByItem([id]);
  return toItem(row!, services(id));
}

/** Publishing in bulk skips photographs without a description, and says so. */
export async function setGalleryStatus(ids: string[], status: Visibility) {
  const rows = await db.select().from(schema.galleryItem).where(inArray(schema.galleryItem.id, ids));

  const eligible =
    status === "published" ? rows.filter((row) => row.image.alt.trim()) : rows;
  const skipped = rows.length - eligible.length;

  if (eligible.length) {
    await db
      .update(schema.galleryItem)
      .set({ status, updatedAt: new Date() })
      .where(
        inArray(
          schema.galleryItem.id,
          eligible.map((row) => row.id),
        ),
      );
  }
  return { updated: eligible.length, skipped };
}

export async function reorderGallery(ids: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx.update(schema.galleryItem).set({ position }).where(eq(schema.galleryItem.id, id));
    }
  });
}

export async function deleteGalleryItems(ids: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(schema.galleryItem).where(inArray(schema.galleryItem.id, ids));
    const rest = await tx
      .select()
      .from(schema.galleryItem)
      .orderBy(asc(schema.galleryItem.position));
    for (const [position, item] of rest.entries()) {
      await tx.update(schema.galleryItem).set({ position }).where(eq(schema.galleryItem.id, item.id));
    }
  });
}
