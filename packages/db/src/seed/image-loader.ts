import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { plugin } from "bun";

/** `apps/web/src` — what the website's own `@/…` imports point at. */
const WEB_SRC = resolve(fileURLToPath(import.meta.url), "../../../../../apps/web/src");

/**
 * Lets the seed import the website's own content files unchanged.
 *
 * `content/media.ts` statically imports photographs, which Next turns into
 * `StaticImageData`. Outside Next there is no such loader, so this plugin
 * supplies one: it reads the real intrinsic size out of the file and returns
 * the same shape, with the site-relative path the database stores.
 *
 * Reading the content files as they are — rather than transcribing them — is
 * the point: the seeded database is the live site, not an approximation of
 * it, and it stays that way when the copy changes.
 */

/** Intrinsic size, straight from the file header. */
export function imageSize(path: string): { width: number; height: number } {
  const buffer = readFileSync(path);

  // PNG: an 8-byte signature, then the IHDR chunk carries the dimensions.
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  // JPEG: walk the marker segments to the start-of-frame, which holds them.
  if (buffer.length > 4 && buffer.readUInt16BE(0) === 0xffd8) {
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1]!;
      // SOF0–SOF15 carry the frame header; DHT, JPG and DAC do not.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }

  throw new Error(`Could not read the dimensions of ${path}`);
}

plugin({
  name: "static-image",
  setup(build) {
    // The website's own path alias, so its content files import as they do
    // inside Next — no tsconfig gymnastics, no copies to drift.
    build.onResolve({ filter: /^@\// }, (args) => {
      const base = resolve(WEB_SRC, args.path.slice(2));
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        if (existsSync(candidate)) return { path: candidate };
      }
      return { path: base };
    });

    build.onLoad({ filter: /\.(jpe?g|png|webp|avif)$/ }, (args) => {
      const { width, height } = imageSize(args.path);
      const data = {
        // Where the file is served from, now that it lives in `public/media`.
        src: `/media/${basename(args.path)}`,
        width,
        height,
        blurDataURL: "",
        blurWidth: 0,
        blurHeight: 0,
      };
      return { contents: `export default ${JSON.stringify(data)};`, loader: "js" };
    });
  },
});
