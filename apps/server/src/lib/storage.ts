import { randomUUID } from "node:crypto";

import { CmsValidationError } from "@CC-City-Chauffeurs/core";
import { env } from "@CC-City-Chauffeurs/env/server";

import { imageSize, sniffImageType } from "./image-size";

/**
 * Where a photograph lives: a Cloudflare R2 bucket, read by the public
 * through the bucket's public address.
 *
 * The caller hands over a file and gets back an address, a key, dimensions
 * and a size. The database keeps the address, which is what the website and
 * the admin render, and the key, which is what lets the file be replaced or
 * removed from the bucket when its record is.
 *
 * A key is never written twice. An upload gets a fresh name every time, so a
 * page that is already pointing at a photograph never finds it changed
 * underneath, and the address can be cached forever. Replacing a photograph
 * is a new key and a rewrite of every record that referred to the old one.
 *
 * The bucket may be shared with other projects, so everything this site
 * stores sits under one prefix, and nothing outside it is ever listed,
 * written or deleted.
 */

const ACCEPTED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

export const MAX_BYTES = 25 * 1024 * 1024;

export type StoredFile = {
  src: string;
  key: string;
  width: number;
  height: number;
  filename: string;
  bytes: number;
};

let client: Bun.S3Client | null = null;

/** The bucket, connected on first use so that importing this costs nothing. */
function bucket() {
  client ??= new Bun.S3Client({
    accessKeyId: env.R2_PUBLIC_ACCESS_KEY_ID,
    secretAccessKey: env.R2_PUBLIC_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  });
  return client;
}

/** The key a path under this site's prefix is stored at: "media/x.jpg" → "<prefix>/media/x.jpg". */
export function objectKey(path: string) {
  return `${env.R2_PREFIX}/${path.replace(/^\/+/, "")}`;
}

/** Where the public reads a key from. */
export function publicUrl(key: string) {
  return `${env.R2_PUBLIC_BASE_URL}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** The key behind one of our own addresses, or null for an address that is not ours. */
export function keyFromSrc(src: string): string | null {
  const base = `${env.R2_PUBLIC_BASE_URL}/${encodeURIComponent(env.R2_PREFIX)}/`;
  if (!src.startsWith(base)) return null;
  const rest = src.slice(base.length).split("/").map(decodeURIComponent).join("/");
  return rest ? `${env.R2_PREFIX}/${rest}` : null;
}

export type ImageBytes = {
  bytes: Uint8Array;
  type: string;
  extension: string;
  width: number;
  height: number;
};

/**
 * Reads an upload as an image, refusing anything that is not one.
 *
 * The type — and so the extension it is stored under and the content type
 * it is served with — comes from what the bytes are, never from what the
 * browser said they were. The dimensions come from the same header.
 */
export async function readImage(file: File): Promise<ImageBytes> {
  if (!ACCEPTED[file.type]) {
    throw new CmsValidationError({
      file: `“${file.name}” is not a JPEG, PNG, WebP or AVIF image.`,
    });
  }
  if (file.size > MAX_BYTES) {
    throw new CmsValidationError({ file: `“${file.name}” is larger than 25 MB.` });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  const extension = type ? ACCEPTED[type] : undefined;
  const size = extension ? imageSize(bytes) : null;
  if (!type || !extension || !size || !size.width || !size.height) {
    throw new CmsValidationError({ file: `“${file.name}” could not be read as an image.` });
  }
  return { bytes, type, extension, width: size.width, height: size.height };
}

/** Writes an object. The caller chooses the key; see the note on keys above. */
export async function putObject(key: string, data: Uint8Array | Blob, type: string): Promise<void> {
  await bucket().write(key, data, { type });
}

export async function objectExists(key: string): Promise<boolean> {
  return bucket().exists(key);
}

/**
 * Removes an object. Never throws: by the time this is called the record
 * that pointed at the file has already gone, and a file left behind in the
 * bucket is a small cost, whereas an error here would report a deletion that
 * did happen as one that did not.
 */
export async function deleteObject(key: string): Promise<void> {
  try {
    await bucket().delete(key);
  } catch (error) {
    console.error(`[storage] could not delete ${key} — it is still in the bucket`, error);
  }
}

/** Every key under this site's prefix. Nothing outside it is visible from here. */
export async function listObjects(path = ""): Promise<{ key: string; size: number }[]> {
  const prefix = objectKey(path);
  const found: { key: string; size: number }[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await bucket().list({ prefix, continuationToken, maxKeys: 1000 });
    for (const item of page.contents ?? []) found.push({ key: item.key, size: item.size ?? 0 });
    continuationToken = page.isTruncated ? page.nextContinuationToken : undefined;
  } while (continuationToken);
  return found;
}

/** Stores an upload under a fresh key of its own. */
export async function storeUpload(file: File): Promise<StoredFile> {
  const image = await readImage(file);
  const key = objectKey(`uploads/${randomUUID()}${image.extension}`);
  await putObject(key, image.bytes, image.type);
  return {
    src: publicUrl(key),
    key,
    width: image.width,
    height: image.height,
    filename: file.name,
    bytes: file.size,
  };
}
