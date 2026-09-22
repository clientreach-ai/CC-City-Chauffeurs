import type { ImageRef, MediaAsset, MediaUsage } from "@CC-City-Chauffeurs/core";
import type { MediaUpdateInput } from "@CC-City-Chauffeurs/core/schemas";

import { api, uploadFile } from "./client";
import { checkImageFile, UploadError } from "../storage";

/**
 * The media library — every photograph the editors can choose from, and
 * where each one is used.
 *
 * An upload is one round trip: the file goes to the API, which stores it in
 * the bucket and records the address it came back with. There is no
 * half-uploaded state and no record pointing at a file that was never
 * written.
 */

export async function getMedia() {
  return api.get<MediaAsset[]>("/media");
}

export async function getAsset(id: string) {
  return api.get<MediaAsset>(`/media/${id}`);
}

/** Every place each photograph is used, keyed by photograph. Unused ones are absent. */
export async function getMediaUsage() {
  return api.get<Record<string, MediaUsage[]>>("/media/usage");
}

export async function getAssetUsage(id: string) {
  return api.get<MediaUsage[]>(`/media/${id}/usage`);
}

export async function uploadMedia(file: File, alt = "") {
  const problem = checkImageFile(file);
  if (problem) throw new UploadError(problem);

  const form = new FormData();
  form.append("file", file);
  if (alt) form.append("alt", alt);
  return uploadFile<MediaAsset>("/media/upload", form);
}

export async function updateMedia(id: string, input: MediaUpdateInput) {
  return api.patch<MediaAsset>(`/media/${id}`, input);
}

/** A new file takes this photograph's place everywhere it is used, live pages included. */
export async function replaceMedia(id: string, file: File) {
  const problem = checkImageFile(file);
  if (problem) throw new UploadError(problem);

  const form = new FormData();
  form.append("file", file);
  return uploadFile<{ asset: MediaAsset; replaced: number }>(`/media/${id}/replace`, form);
}

/** Refused while a page still shows it — the API says where. */
export async function deleteMedia(id: string) {
  return api.delete<void>(`/media/${id}`);
}

export function toImageRef(asset: MediaAsset, alt = asset.alt): ImageRef {
  return { src: asset.src, width: asset.width, height: asset.height, alt, assetId: asset.id };
}
