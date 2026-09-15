import type { ImageRef } from "./types";

/**
 * Where a stored photograph actually lives.
 *
 * The database keeps the site's own photography as site-relative paths
 * ("/media/fleet-cullinan.jpg"), so the records survive a rebuild, a new
 * deploy and a change of domain — none of which a "/_next/static/…" URL
 * would. An uploaded file, once object storage exists, is stored as the
 * absolute address the CDN gives back.
 *
 * The website resolves a relative path against itself and needs no base. The
 * admin runs on its own origin, so it passes the website's URL and gets an
 * absolute address back.
 */
export function resolveImageSrc(src: string, base?: string): string {
  if (!src) return "";
  // Already absolute, a data URL, or a blob from a local preview.
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  if (!base) return src;
  return `${base.replace(/\/+$/, "")}${src.startsWith("/") ? "" : "/"}${src}`;
}

export function resolveImage<T extends ImageRef | null | undefined>(
  image: T,
  base?: string,
): T {
  if (!image) return image;
  return { ...image, src: resolveImageSrc(image.src, base) } as T;
}

export function resolveImages(images: ImageRef[], base?: string): ImageRef[] {
  return images.map((image) => resolveImage(image, base));
}
