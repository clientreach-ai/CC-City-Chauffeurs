/**
 * What a file actually is, from its first bytes — never from the name or the
 * type the browser claimed. Only the formats the admin accepts are named.
 */
export function sniffImageType(bytes: Uint8Array) {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 8 && ascii(1, 4) === "PNG" && bytes[0] === 0x89) return "image/png";
  if (bytes.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (bytes.length > 12 && ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) {
    return "image/avif";
  }
  return null;
}

/**
 * Intrinsic size, straight from an image's own header.
 *
 * The admin needs the real dimensions of an upload to lay it out and to store
 * an `ImageRef`, and the browser's word for it cannot be trusted on a file
 * that arrived over the wire.
 */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // AVIF: an ISO-BMFF "ftyp" box naming avif, and an "ispe" property box
  // (version and flags, then width and height) somewhere in the metadata.
  if (sniffImageType(bytes) === "image/avif") {
    for (let i = 12; i < Math.min(bytes.length - 16, 64 * 1024); i++) {
      if (view.getUint32(i) === 0x69737065 /* ispe */) {
        return { width: view.getUint32(i + 8), height: view.getUint32(i + 12) };
      }
    }
    return null;
  }

  // PNG: an 8-byte signature, then IHDR carries the dimensions.
  if (bytes.length > 24 && view.getUint32(0) === 0x89504e47) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  // GIF: little-endian, straight after the header.
  if (bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }

  // WebP: "RIFF"…"WEBP", then one of three chunk layouts.
  if (bytes.length > 30 && view.getUint32(0) === 0x52494646 && view.getUint32(8) === 0x57454250) {
    const chunk = view.getUint32(12);
    if (chunk === 0x56503820 /* VP8  */) {
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    }
    if (chunk === 0x5650384c /* VP8L */) {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 0x56503858 /* VP8X */) {
      const at = (i: number) => bytes[i]!;
      return {
        width: (at(24) | (at(25) << 8) | (at(26) << 16)) + 1,
        height: (at(27) | (at(28) << 8) | (at(29) << 16)) + 1,
      };
    }
  }

  // JPEG: walk the marker segments to the start-of-frame.
  if (bytes.length > 4 && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset < bytes.length - 9) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1]!;
      // SOF0–SOF15 carry the frame header; DHT, JPG and DAC do not.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
      }
      offset += 2 + view.getUint16(offset + 2);
    }
  }

  return null;
}
