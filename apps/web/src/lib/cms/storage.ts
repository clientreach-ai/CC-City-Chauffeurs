import type { MediaAsset } from "./types";

/**
 * File storage — the seam for uploads.
 *
 * `MediaStorage` is what the media repository calls. Today's implementation
 * does NOT upload anything: it reads the file in the browser and keeps a
 * reduced preview copy alongside the rest of the local CMS data, so the
 * editors can be used end to end. Nothing leaves the device.
 *
 * The production implementation (e.g. Cloudflare R2 or S3) keeps the same
 * signature: request a signed upload URL from the API, PUT the original file
 * to it, and return the public CDN address and dimensions. No screen changes.
 */

export type StoredFile = Pick<MediaAsset, "src" | "width" | "height" | "filename" | "bytes" | "origin">;

export interface MediaStorage {
  /** Human description for the UI, e.g. where files go. */
  readonly description: string;
  upload(file: File): Promise<StoredFile>;
}

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

export function checkImageFile(file: File) {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return `“${file.name}” is not a JPEG, PNG, WebP or AVIF image.`;
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return `“${file.name}” is larger than 25 MB.`;
  }
  return null;
}

/** Longest edge of the local preview, and its JPEG quality. */
const PREVIEW = { edge: 960, quality: 0.78 } as const;

/**
 * Preview-only storage: downsizes the image and keeps it as a data URL. It is
 * deliberately small — browser storage holds a few megabytes at most.
 */
export const localPreviewStorage: MediaStorage = {
  description: "Kept in this browser as a reduced preview — not uploaded.",
  async upload(file) {
    const problem = checkImageFile(file);
    if (problem) throw new UploadError(problem);

    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new UploadError(`“${file.name}” could not be read as an image.`);
    }

    const scale = Math.min(1, PREVIEW.edge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new UploadError("This browser could not prepare the preview.");
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const src = canvas.toDataURL("image/jpeg", PREVIEW.quality);
    return {
      src,
      width,
      height,
      filename: file.name,
      // Base64 carries four characters for every three bytes.
      bytes: Math.round(((src.length - src.indexOf(",") - 1) * 3) / 4),
      origin: "local",
    };
  },
};

/** The storage the admin uses. Swap for the real implementation later. */
export const mediaStorage: MediaStorage = localPreviewStorage;
