import sharp, { type OutputInfo } from "sharp";

import { CmsValidationError } from "@CC-City-Chauffeurs/core";

/**
 * What an uploaded photograph becomes before it is stored.
 *
 * Editors upload what their camera or phone gives them: a 6000-pixel JPEG of
 * 15 MB, sideways according to its EXIF, carrying the GPS position it was
 * taken at. Stored as it came, every page that shows it makes the image
 * optimiser fetch and decode all of that on each cold request, and anyone can
 * download the original — location included.
 *
 * So each upload is, once, at the moment it arrives:
 *
 *   - turned the right way up (EXIF orientation applied, then discarded);
 *   - scaled down to at most MAX_EDGE on its longer side — never up;
 *   - re-encoded as WebP, which every browser the site supports can show and
 *     which the website's optimiser reads quickly to produce AVIF for the
 *     browsers that want it. WebP rather than AVIF as the stored copy
 *     because an AVIF encode of a full-size photograph takes seconds of CPU on
 *     the API's server, and the optimiser re-encodes for delivery anyway;
 *   - stripped of metadata: no GPS, no camera serial, no editing history.
 *
 * A file that would come out larger than it went in — already a small WebP,
 * say — is kept exactly as it was, but only if it needs no resizing and
 * carries no metadata to strip.
 */

/** Nothing on the website draws a photograph wider than this. */
export const MAX_EDGE = 2400;

/**
 * High enough that the website's own re-encode (at 80) is not compounding a
 * visible loss, low enough to take most of the weight off a camera JPEG.
 */
export const WEBP_QUALITY = 82;

/**
 * About 100 megapixels. Larger than any camera the editors are likely to
 * use, and small enough that decoding one fits in the API's memory limit.
 */
export const MAX_PIXELS = 100_000_000;

// One upload at a time is the norm, and the API runs with a memory ceiling:
// no decoded-image cache to hold on to.
sharp.cache(false);

export type ConvertedImage = {
  bytes: Uint8Array;
  type: string;
  extension: string;
  width: number;
  height: number;
};

export async function convertForWeb(
  input: Uint8Array,
  original: { type: string; extension: string },
  { maxPixels = MAX_PIXELS }: { maxPixels?: number } = {},
): Promise<ConvertedImage> {
  let output: { data: Buffer; info: OutputInfo };
  let sourceWidth: number;
  let sourceHeight: number;
  let carriesMetadata: boolean;
  try {
    const image = sharp(input, { limitInputPixels: maxPixels, failOn: "error" });
    const metadata = await image.metadata();
    // EXIF orientations 5–8 are a quarter turn: the stored width is the height.
    const quarterTurn = (metadata.orientation ?? 1) >= 5;
    sourceWidth = (quarterTurn ? metadata.height : metadata.width) ?? 0;
    sourceHeight = (quarterTurn ? metadata.width : metadata.height) ?? 0;
    carriesMetadata = Boolean(metadata.exif || metadata.xmp || metadata.iptc);

    output = await image
      .rotate()
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/pixel limit/i.test(message)) {
      throw new CmsValidationError({
        file: "That image has too many pixels to process. Export it at a smaller size and try again.",
      });
    }
    throw new CmsValidationError({ file: "That file could not be read as an image." });
  }

  const resized = output.info.width !== sourceWidth || output.info.height !== sourceHeight;
  if (!resized && !carriesMetadata && output.data.byteLength >= input.byteLength) {
    return {
      bytes: input,
      type: original.type,
      extension: original.extension,
      width: sourceWidth,
      height: sourceHeight,
    };
  }

  return {
    bytes: new Uint8Array(output.data),
    type: "image/webp",
    extension: ".webp",
    width: output.info.width,
    height: output.info.height,
  };
}
