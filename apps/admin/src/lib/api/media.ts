import type { ImageRef, MediaAsset } from "@CC-City-Chauffeurs/core";

import { api, uploadFile } from "./client";
import { checkImageFile, UploadError } from "../storage";

/**
 * The media library — every photograph the editors can choose from.
 *
 * An upload is one round trip: the file goes to the API, which stores it and
 * records the address it came back with. There is no half-uploaded state and
 * no row pointing at a file that was never written.
 */

export async function getMedia() {
  return api.get<MediaAsset[]>("/media");
}

export async function uploadMedia(file: File) {
  const problem = checkImageFile(file);
  if (problem) throw new UploadError(problem);

  const form = new FormData();
  form.append("file", file);
  return uploadFile<MediaAsset>("/media/upload", form);
}

/** The website's own photography belongs to the codebase, not the admin. */
export async function deleteMedia(id: string) {
  return api.delete<void>(`/media/${id}`);
}

export function toImageRef(asset: MediaAsset, alt = asset.alt): ImageRef {
  return { src: asset.src, width: asset.width, height: asset.height, alt, assetId: asset.id };
}
