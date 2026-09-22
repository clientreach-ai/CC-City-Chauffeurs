/**
 * What the admin checks before a file leaves the browser.
 *
 * The API checks all of this again — it has to, since a request can be made
 * without this code running at all. Doing it here as well just means an
 * editor is told about a 40 MB TIFF straight away instead of after uploading
 * it.
 */

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

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

/** Shown beside the upload control so it is clear where files go. */
export const storageDescription = "Stored in the site's own bucket and served from there.";
