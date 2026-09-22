/**
 * Moves the website's photography into the bucket.
 *
 * The site began with its photographs in the website's own `public/` folder,
 * served by the website and recorded in the database by their path there
 * ("/media/fleet-cullinan.jpg"). Photographs uploaded through the admin went
 * to the API's own disk. Both live in R2 now, and this is what puts them
 * there:
 *
 *   1. every image under apps/web/public/{media,gallery,og} is written to the
 *      bucket at the same path under this site's prefix. A key that is already
 *      there is left alone, so this can be run again — after a photograph has
 *      been deleted from the library by mistake, say — and only fills gaps;
 *   2. every photograph the API kept on its own disk that a media record still
 *      points at is written under uploads/, keeping its name;
 *   3. every media record, and every reference on the website — a vehicle's
 *      photographs, a service's gallery, the homepage bands, the share image —
 *      is rewritten from the old address to the new one, in one transaction.
 *      A file with no record is given one, so the library shows everything
 *      the bucket holds.
 *
 * Nothing is deleted. The files in `public/` stay as the seed's source, and
 * the disk uploads stay where they were.
 *
 * Before anything in the database is touched, one of the uploaded files is
 * fetched through the public address. A bucket that is not public yet, or a
 * public address that belongs to a different bucket, would otherwise leave
 * every page pointing at a 404 — so the records are only rewritten once the
 * address is known to serve.
 *
 *   bun run scripts/migrate-media-to-r2.ts            # says what it would do
 *   bun run scripts/migrate-media-to-r2.ts --apply    # does it
 *   bun run scripts/migrate-media-to-r2.ts --revert --apply
 *                                                     # points the records back at the old addresses
 *
 * On the server, where the disk uploads are:
 *   bun --env-file .env.production run scripts/migrate-media-to-r2.ts --apply
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import { db, schema } from "@CC-City-Chauffeurs/db";
import { env } from "@CC-City-Chauffeurs/env/server";
import { eq } from "drizzle-orm";

import { imageSize } from "../src/lib/image-size";
import { objectExists, objectKey, publicUrl, putObject } from "../src/lib/storage";
import { rewriteImageRefs } from "../src/repositories/media";

const apply = process.argv.includes("--apply");
/** Points every record back at the address it had before. The files stay in the bucket. */
const revert = process.argv.includes("--revert");

/** The website's static folders, as the database named them. */
const WEB_PUBLIC = resolve(import.meta.dir, "../../web/public");
const FOLDERS = ["media", "gallery", "og"];

/** Where the API used to keep uploads — relative to apps/server, as it always was. */
const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR ?? "./uploads");

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

/** One file, where it was and where it is going. */
type Move = {
  /** The address the database knows it by. */
  from: string;
  key: string;
  src: string;
  file: string;
  type: string;
  bytes: number;
};

async function siteFiles(): Promise<Move[]> {
  const moves: Move[] = [];
  for (const folder of FOLDERS) {
    const dir = join(WEB_PUBLIC, folder);
    const names = await readdir(dir).catch(() => [] as string[]);
    for (const name of names.sort()) {
      const type = TYPES[extname(name).toLowerCase()];
      if (!type) continue;
      const file = join(dir, name);
      const info = await stat(file);
      if (!info.isFile()) continue;
      const key = objectKey(`${folder}/${name}`);
      moves.push({ from: `/${folder}/${name}`, key, src: publicUrl(key), file, type, bytes: info.size });
    }
  }
  return moves;
}

/** Records still pointing at the API's disk, and whether the file is on this machine. */
async function diskUploads(): Promise<{ moves: Move[]; missing: string[] }> {
  const rows = await db.select().from(schema.mediaAsset);
  const moves: Move[] = [];
  const missing: string[] = [];
  for (const row of rows) {
    if (row.src.startsWith(env.R2_PUBLIC_BASE_URL)) continue;
    const match = /\/uploads\/([^/?#]+)$/.exec(row.src);
    if (!match?.[1]) continue;
    const name = match[1];
    const type = TYPES[extname(name).toLowerCase()];
    const file = join(UPLOAD_DIR, name);
    const info = await stat(file).catch(() => null);
    if (!type || !info?.isFile()) {
      missing.push(row.src);
      continue;
    }
    const key = objectKey(`uploads/${name}`);
    moves.push({ from: row.src, key, src: publicUrl(key), file, type, bytes: info.size });
  }
  return { moves, missing };
}

/** Thrown to roll a dry run back after it has counted what it would change. */
class DryRun extends Error {}

/**
 * Whether the public address actually serves a file from the bucket.
 *
 * The S3 credentials prove nothing about this: a bucket can be written to
 * and still have public access switched off, and an r2.dev address belongs
 * to one bucket only. Fetched with a range so that only the first byte
 * comes back.
 */
async function servesPublicly(key: string): Promise<boolean> {
  const response = await fetch(publicUrl(key), { headers: { Range: "bytes=0-0" } }).catch(() => null);
  return response !== null && (response.status === 200 || response.status === 206);
}

async function main() {
  const verb = revert ? (apply ? "Pointing" : "Would point") : apply ? "Moving" : "Would move";
  console.log(
    revert
      ? `${verb} the records back at the addresses they had before the move to ${env.R2_BUCKET}/${env.R2_PREFIX}\n`
      : `${verb} photographs into ${env.R2_BUCKET}/${env.R2_PREFIX}, served from ${env.R2_PUBLIC_BASE_URL}\n`,
  );

  const site = await siteFiles();
  const disk = await diskUploads();
  const moves = [...site, ...disk.moves];
  /** Old address → the move, or new address → the move when reverting. */
  const bySrc = new Map(moves.map((move) => [revert ? move.src : move.from, move]));

  // ------------------------------------------------------------ files
  let uploaded = 0;
  let present = 0;
  if (!revert) {
    for (const move of moves) {
      if (await objectExists(move.key)) {
        present += 1;
        continue;
      }
      if (apply) {
        await putObject(move.key, await readFile(move.file), move.type);
        console.log(`  put  ${move.key}  (${(move.bytes / 1024).toFixed(0)} KB)`);
      }
      uploaded += 1;
    }
    console.log(`\n${apply ? "Uploaded" : "Would upload"} ${uploaded} ${uploaded === 1 ? "file" : "files"}; ${present} already in the bucket.`);
    for (const src of disk.missing) console.log(`  !! ${src} — the file is not on this machine; its record is left as it is`);

    // The records are only pointed at the bucket once the bucket is known to answer.
    const sample = apply || present > 0 ? moves[0] : undefined;
    if (sample && !(await servesPublicly(sample.key))) {
      console.error(
        `\n!! ${publicUrl(sample.key)} does not serve the file that is in the bucket.\n` +
          `   Either public access is not enabled on "${env.R2_BUCKET}" or R2_PUBLIC_BASE_URL is another bucket's address.\n` +
          `   In Cloudflare, open the bucket → Settings → Public access: allow the r2.dev subdomain, or connect a custom\n` +
          `   domain, and set R2_PUBLIC_BASE_URL to it. Then run this again. The database has not been touched.`,
      );
      process.exit(2);
    }
    if (!sample) console.log("   (nothing in the bucket yet, so whether the public address serves cannot be checked on a dry run)");
  }

  // ------------------------------------------------------------ records
  let recordsRewritten = 0;
  let recordsAdded = 0;
  let referencesRewritten = 0;
  try {
    await db.transaction(async (tx) => {
      const rows = await tx.select().from(schema.mediaAsset);
      const known = new Set<string>();
      for (const row of rows) {
        const move = bySrc.get(row.src);
        if (!move) continue;
        known.add(move.from);
        await tx
          .update(schema.mediaAsset)
          .set(
            revert
              ? { src: move.from, key: null }
              : { src: move.src, key: move.key, bytes: row.bytes ?? move.bytes },
          )
          .where(eq(schema.mediaAsset.id, row.id));
        recordsRewritten += 1;
      }
      // A row whose address is already the bucket's counts as known too.
      for (const row of rows) {
        const move = moves.find((candidate) => candidate.src === row.src);
        if (move) known.add(move.from);
      }

      // Files the library has never heard of get a record, so that what the
      // bucket holds and what the library shows are the same thing.
      if (!revert) {
        for (const move of site) {
          if (known.has(move.from)) continue;
          const size = imageSize(new Uint8Array(await readFile(move.file)));
          if (!size) continue;
          await tx.insert(schema.mediaAsset).values({
            id: `site-${move.from.slice(1).replace(/[^a-z0-9]+/gi, "-").replace(/\.\w+$/, "")}`,
            src: move.src,
            key: move.key,
            width: size.width,
            height: size.height,
            alt: "",
            filename: move.from.split("/").pop() ?? move.from,
            origin: "site",
            bytes: move.bytes,
          });
          recordsAdded += 1;
        }
      }

      referencesRewritten = await rewriteImageRefs(tx, (ref) => {
        const move = bySrc.get(ref.src);
        return move ? { ...ref, src: revert ? move.from : move.src } : null;
      });

      if (!apply) throw new DryRun();
    });
  } catch (error) {
    if (!(error instanceof DryRun)) throw error;
  }

  console.log(
    `${apply ? "Rewrote" : "Would rewrite"} ${recordsRewritten} media ${recordsRewritten === 1 ? "record" : "records"}, ` +
      `${apply ? "added" : "add"} ${recordsAdded}, and ${apply ? "rewrote" : "rewrite"} ${referencesRewritten} ` +
      `${referencesRewritten === 1 ? "reference" : "references"} on the website.`,
  );
  if (!apply) console.log("\nNothing was changed. Run again with --apply to do it.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
