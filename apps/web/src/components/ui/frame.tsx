import Image, { type StaticImageData } from "next/image";

/**
 * A photograph in a fixed-ratio frame.
 *
 * Every image on the site goes through here so three things are guaranteed
 * in one place rather than remembered at thirty call sites:
 *
 *   · the box reserves its space before the file arrives, so nothing shifts
 *   · `sizes` is always passed, so phones never fetch desktop-width files
 *   · the frame clips, so the hover zoom can never bleed past the hairline
 *
 * `priority` is deliberately not exposed — only the hero and page headers
 * should pre-load, and they compose `next/image` directly.
 */
export function Frame({
  src,
  alt,
  sizes,
  ratio = "4/5",
  position = "center",
  quality,
  zoom = false,
  className = "",
}: {
  src: StaticImageData;
  alt: string;
  /** Rendered width at each breakpoint. Required — there is no safe default. */
  sizes: string;
  ratio?: string;
  position?: string;
  quality?: number;
  zoom?: boolean;
  className?: string;
}) {
  return (
    <div
      style={{ aspectRatio: ratio }}
      className={`relative w-full overflow-hidden rounded-[var(--radius-media)] bg-graphite ${
        zoom ? "media-zoom" : ""
      } ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        quality={quality}
        placeholder="blur"
        style={{ objectPosition: position }}
        className="object-cover"
      />
    </div>
  );
}
