import type { GalleryItem, GalleryItemInput, ImageRef, Visibility } from "@CC-City-Chauffeurs/core";

import { api } from "./client";

export { validateGalleryItem } from "@CC-City-Chauffeurs/core";

export async function getGallery() {
  return api.get<GalleryItem[]>("/gallery");
}

export async function getGalleryRows() {
  return api.get<{ id: string; label: string }[]>("/gallery-rows");
}

/**
 * Adds photographs as hidden drafts at the end of the gallery. They are not
 * public until someone describes and publishes them.
 */
export async function addGalleryImages(
  images: ImageRef[],
  defaults: Pick<GalleryItemInput, "row" | "category" | "vehicleId">,
) {
  return api.post<GalleryItem[]>("/gallery", { images, defaults });
}

export async function updateGalleryItem(id: string, input: GalleryItemInput) {
  return api.patch<GalleryItem>(`/gallery/${id}`, input);
}

/** Publishing in bulk skips photographs without a description, and says so. */
export async function setGalleryStatus(ids: string[], status: Visibility) {
  return api.patch<{ updated: number; skipped: number }>("/gallery", { ids, status });
}

export async function reorderGallery(ids: string[]) {
  return api.put<void>("/gallery/order", { ids });
}

export async function deleteGalleryItems(ids: string[]) {
  return api.delete<void>("/gallery", { ids });
}
