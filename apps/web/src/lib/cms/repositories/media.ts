import { mediaStorage } from "../storage";
import { getDatabase, latency, newId, now } from "../store/database";
import type { ImageRef, MediaAsset } from "../types";

/**
 * Media library — every photograph the editors can choose from: the site's
 * own photography, plus anything previewed locally.
 *
 * Future API: GET /media, POST /media (after a signed upload), DELETE /media/:id.
 */

export async function getMedia(): Promise<MediaAsset[]> {
  await latency("read");
  const assets = getDatabase().read("media");
  // Newest local previews first, then the site's photography in order.
  return [
    ...assets.filter((asset) => asset.origin === "local").reverse(),
    ...assets.filter((asset) => asset.origin === "site"),
  ];
}

export async function uploadMedia(file: File): Promise<MediaAsset> {
  const stored = await mediaStorage.upload(file);
  await latency("write");
  const asset: MediaAsset = {
    ...stored,
    id: newId("media"),
    alt: "",
    createdAt: now(),
  };
  getDatabase().write((draft) => {
    draft.media.push(asset);
  });
  return asset;
}

/** Site photography belongs to the codebase and cannot be removed here. */
export async function deleteMedia(id: string): Promise<void> {
  await latency("write");
  getDatabase().write((draft) => {
    draft.media = draft.media.filter((asset) => asset.id !== id || asset.origin === "site");
  });
}

export function toImageRef(asset: MediaAsset, alt = asset.alt): ImageRef {
  return { src: asset.src, width: asset.width, height: asset.height, alt, assetId: asset.id };
}
