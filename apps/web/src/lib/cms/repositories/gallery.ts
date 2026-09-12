import { getDatabase, latency, newId, now } from "../store/database";
import type { GalleryItem, GalleryItemInput, ImageRef, Visibility } from "../types";
import { assertValid, CmsNotFoundError, validator, type FieldErrors } from "../validation";

/**
 * Gallery repository — the photographs on /gallery.
 *
 * Future API: GET/POST /gallery, PATCH/DELETE /gallery/:id,
 * PATCH /gallery (bulk status), PUT /gallery/order.
 */

export function validateGalleryItem(input: GalleryItemInput): FieldErrors {
  return validator()
    .required("image.alt", input.image.alt, "Describe the photograph — it is read aloud to people who cannot see it.")
    .maxLength("image.alt", input.image.alt, 140)
    .maxLength("caption", input.caption, 140)
    .required("row", input.row, "Choose the gallery row this photograph belongs to.")
    .result();
}

export async function getGallery(): Promise<GalleryItem[]> {
  await latency("read");
  return getDatabase()
    .read("gallery")
    .sort((a, b) => a.position - b.position);
}

export async function getGalleryRows() {
  await latency("read");
  return getDatabase().read("galleryRows");
}

/**
 * Adds freshly uploaded photographs as hidden drafts at the end of the
 * gallery. They are not public until someone describes and publishes them.
 */
export async function addGalleryImages(
  images: ImageRef[],
  defaults: Pick<GalleryItemInput, "row" | "category" | "vehicleId">,
): Promise<GalleryItem[]> {
  await latency("write");
  const db = getDatabase();
  const count = db.read("gallery").length;
  const stamp = now();
  const items: GalleryItem[] = images.map((image, i) => ({
    id: newId("gal"),
    image,
    caption: "",
    location: "",
    vehicleId: defaults.vehicleId,
    row: defaults.row,
    category: defaults.category,
    serviceIds: [],
    position: count + i,
    status: "draft",
    createdAt: stamp,
    updatedAt: stamp,
  }));
  db.write((draft) => {
    draft.gallery.push(...items);
  });
  return items;
}

export async function updateGalleryItem(id: string, input: GalleryItemInput): Promise<GalleryItem> {
  await latency("write");
  const errors = validateGalleryItem(input);
  if (input.status === "published" && !input.image.alt.trim()) {
    errors["image.alt"] ??= "Describe the photograph before publishing it.";
  }
  assertValid(errors);
  const db = getDatabase();
  const current = db.read("gallery").find((item) => item.id === id);
  if (!current) throw new CmsNotFoundError("This photograph");
  const next: GalleryItem = { ...current, ...structuredClone(input), updatedAt: now() };
  db.write((draft) => {
    draft.gallery = draft.gallery.map((item) => (item.id === id ? next : item));
  });
  return next;
}

/** Publishing in bulk skips photographs without a description, and says so. */
export async function setGalleryStatus(ids: string[], status: Visibility) {
  await latency("write");
  const db = getDatabase();
  const stamp = now();
  let skipped = 0;
  db.write((draft) => {
    for (const item of draft.gallery) {
      if (!ids.includes(item.id)) continue;
      if (status === "published" && !item.image.alt.trim()) {
        skipped += 1;
        continue;
      }
      item.status = status;
      item.updatedAt = stamp;
    }
  });
  return { updated: ids.length - skipped, skipped };
}

export async function reorderGallery(ids: string[]): Promise<void> {
  await latency("write");
  getDatabase().write((draft) => {
    for (const item of draft.gallery) {
      const position = ids.indexOf(item.id);
      if (position >= 0) item.position = position;
    }
  });
}

export async function deleteGalleryItems(ids: string[]): Promise<void> {
  await latency("write");
  getDatabase().write((draft) => {
    draft.gallery = draft.gallery
      .filter((item) => !ids.includes(item.id))
      .sort((a, b) => a.position - b.position)
      .map((item, position) => ({ ...item, position }));
  });
}
