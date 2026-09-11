/**
 * One-off source optimisation for the site's photography.
 *
 * The client's originals are full-resolution camera files. Next's image
 * optimiser resizes on delivery, so visitors were never served these bytes —
 * but they are slow to build, expensive to cache-warm, and there is no reason
 * to keep a 4000px master in the repository when nothing renders above 2400.
 *
 * This rewrites each JPEG in place at a sane ceiling. Originals are recoverable
 * from git (`git checkout -- apps/web/public/gallery apps/web/src/media`) — the
 * files are committed and were untouched when this was first run.
 *
 *   pnpm --filter web optimise:photos          # rewrite
 *   pnpm --filter web optimise:photos --dry    # report only
 */
import { readdir, stat, rename } from "node:fs/promises";
import { join, extname } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const DIRS = ["public/gallery", "src/media"];
const MAX_EDGE = 2400;
const QUALITY = 80;
const dry = process.argv.includes("--dry");

const kb = (bytes) => Math.round(bytes / 1024);

let before = 0;
let after = 0;
let touched = 0;
let skipped = 0;

for (const dir of DIRS) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    console.warn(`skip ${dir} — not found`);
    continue;
  }

  for (const name of entries) {
    if (![".jpg", ".jpeg"].includes(extname(name).toLowerCase())) continue;

    const path = join(dir, name);
    const original = (await stat(path)).size;
    before += original;

    const image = sharp(path);
    const { width = 0, height = 0 } = await image.metadata();
    const longest = Math.max(width, height);

    const pipeline = sharp(path)
      .rotate() // bake in EXIF orientation before we strip metadata
      .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true });

    if (longest > MAX_EDGE) {
      pipeline.resize({
        width: width >= height ? MAX_EDGE : undefined,
        height: height > width ? MAX_EDGE : undefined,
        withoutEnlargement: true,
      });
    }

    const output = await pipeline.toBuffer();

    // Never make a file bigger than it already was.
    if (output.length >= original) {
      after += original;
      skipped += 1;
      continue;
    }

    after += output.length;
    touched += 1;

    console.log(
      `${dry ? "would write" : "wrote"} ${path.padEnd(42)} ` +
        `${String(kb(original)).padStart(5)}kb -> ${String(kb(output.length)).padStart(5)}kb` +
        `  (${longest}px${longest > MAX_EDGE ? ` -> ${MAX_EDGE}px` : ""})`,
    );

    if (dry) continue;

    // Write beside the original, then swap — an interrupted run can never
    // leave a half-written photograph in place of a good one.
    const temporary = `${path}.tmp`;
    await sharp(output).toFile(temporary);
    await rename(temporary, path);
  }
}

console.log(
  `\n${dry ? "DRY RUN — " : ""}${touched} rewritten, ${skipped} already optimal\n` +
    `${kb(before)}kb -> ${kb(after)}kb ` +
    `(${before ? Math.round((1 - after / before) * 100) : 0}% smaller)`,
);
