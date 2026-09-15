import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import { CmsValidationError } from "@CC-City-Chauffeurs/core";
import { env } from "@CC-City-Chauffeurs/env/server";

import { imageSize } from "./image-size";

/**
 * Where an uploaded photograph goes.
 *
 * Today it goes to disk beside the API and is served back from `/uploads`.
 * That is deliberately the same shape as object storage: the caller hands
 * over a file and gets back a URL, dimensions and a size. Swapping this for
 * R2 or S3 — a signed PUT and a CDN address — changes this file and nothing
 * else, because the database only ever stores the URL that comes out of it.
 */

export const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR ?? "./uploads");

const ACCEPTED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

const MAX_BYTES = 25 * 1024 * 1024;

export type StoredFile = {
  src: string;
  width: number;
  height: number;
  filename: string;
  bytes: number;
};

export async function storeUpload(file: File): Promise<StoredFile> {
  const extension = ACCEPTED[file.type];
  if (!extension) {
    throw new CmsValidationError({
      file: `“${file.name}” is not a JPEG, PNG, WebP or AVIF image.`,
    });
  }
  if (file.size > MAX_BYTES) {
    throw new CmsValidationError({ file: `“${file.name}” is larger than 25 MB.` });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const size = imageSize(bytes);
  if (!size) {
    throw new CmsValidationError({ file: `“${file.name}” could not be read as an image.` });
  }

  // A fresh name every time: an upload never overwrites what a published
  // page is already pointing at, and the URL can be cached forever.
  const name = `${randomUUID()}${extension || extname(file.name)}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, name), bytes);

  return {
    // Absolute, because the website and the admin are both other origins.
    src: `${env.API_URL.replace(/\/+$/, "")}/uploads/${name}`,
    width: size.width,
    height: size.height,
    filename: file.name,
    bytes: file.size,
  };
}
