/**
 * Fills the image optimiser's cache for every page's hero after a deploy.
 *
 * A hero photograph is the largest thing on the first screen, and each width
 * of it is encoded on the first request after a deploy or a restart — 0.6 to
 * 1.8 seconds apiece, with the source fetched from object storage. Without
 * this, the first visitors of the day are the ones who pay for it.
 *
 * It reads the sitemap, finds the images each page preloads (the heroes —
 * see `preload` on next/image), and asks for every width in both formats the
 * site serves, a few at a time.
 *
 *   node scripts/warm-images.mjs https://www.city-chauffeurs.com
 *   pnpm --filter web warm:images https://www.city-chauffeurs.com
 */

const site = (process.argv[2] ?? "http://localhost:3001").replace(/\/+$/, "");
const FORMATS = ["image/avif", "image/webp"];
const CONCURRENCY = 4;

const decode = (value) => value.replaceAll("&amp;", "&");

async function pagesFromSitemap() {
  const response = await fetch(`${site}/sitemap.xml`);
  if (!response.ok) throw new Error(`sitemap.xml answered ${response.status}`);
  const xml = await response.text();
  // The sitemap names the canonical domain; warm the one we were given.
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, loc]) => `${site}${new URL(loc).pathname}`,
  );
}

async function preloadedImages(page) {
  const html = await (await fetch(page)).text();
  const urls = new Set();
  for (const [tag] of html.matchAll(/<link rel="preload" as="image"[^>]*>/g)) {
    const srcset = tag.match(/imageSrcSet="([^"]+)"/)?.[1];
    for (const candidate of decode(srcset ?? "").split(",")) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url) urls.add(new URL(url, site).href);
    }
  }
  return [...urls];
}

async function warm(url, accept) {
  const started = Date.now();
  const response = await fetch(url, { headers: { Accept: accept } });
  await response.arrayBuffer();
  return { ok: response.ok, status: response.status, ms: Date.now() - started };
}

const pages = await pagesFromSitemap();
const jobs = [];
for (const page of pages) {
  for (const url of await preloadedImages(page)) {
    for (const accept of FORMATS) jobs.push({ url, accept });
  }
}

let failed = 0;
let slow = 0;
const queue = [...jobs];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const result = await warm(job.url, job.accept).catch(() => ({ ok: false, status: 0, ms: 0 }));
      if (!result.ok) {
        failed += 1;
        console.warn(`  ${result.status || "error"}  ${job.accept}  ${job.url}`);
      } else if (result.ms > 300) {
        slow += 1; // encoded just now rather than served from the cache
      }
    }
  }),
);

console.log(
  `Warmed ${jobs.length - failed} of ${jobs.length} hero variants across ${pages.length} pages` +
    ` (${slow} encoded just now).`,
);
if (failed) process.exit(1);
