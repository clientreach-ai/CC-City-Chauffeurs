import { allowImagesFrom } from "@CC-City-Chauffeurs/env/images";
import { env } from "@CC-City-Chauffeurs/env/web";
import type { NextConfig } from "next";


/**
 * Sent with every page. Deliberately no script policy: Next inlines its own
 * bootstrapping, and a CSP that has to be loosened for that protects little
 * while breaking a lot. What these do stop is the page being framed by
 * another site (clickjacking), a response being re-typed by the browser, and
 * the full address leaking to other sites in the Referer.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // Nothing gains from being told which framework served the page.
  poweredByHeader: false,
  typedRoutes: true,
  reactCompiler: true,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },

  /**
   * Addresses that are, or were, in circulation and must keep working.
   * Permanent (308), so search engines move what they had indexed across.
   * A query string survives the redirect untouched, which is why none of
   * these name one: `?service=` from an old quote link still preselects.
   */
  async redirects() {
    return [
      // The quote form and the booking form are one page now. Both addresses
      // were live and may have been sent to somebody.
      { source: "/request-a-quote", destination: "/request-a-chauffeur", permanent: true },
      { source: "/book", destination: "/request-a-chauffeur", permanent: true },

      // The previous site's one page that has no namesake here: Showcase was
      // merged into the Gallery (PRD §9, §10.7). Its other pages — /, /about,
      // /fleet, /gallery, /contact — kept their addresses.
      { source: "/showcase", destination: "/gallery", permanent: true },

      // The addresses the PRD's site plan (§9) proposed, which the build
      // settled differently. Each proposed slug that was renamed is mapped to
      // its page before the general rule passes the rest straight through.
      { source: "/quote", destination: "/request-a-chauffeur", permanent: true },
      { source: "/services", destination: "/chauffeur-services", permanent: true },
      { source: "/services/private-events", destination: "/chauffeur-services/events", permanent: true },
      { source: "/services/tours-sightseeing", destination: "/chauffeur-services/tours", permanent: true },
      { source: "/services/school-family-runs", destination: "/chauffeur-services/school-family", permanent: true },
      { source: "/services/supercar-chauffeur", destination: "/supercar-experiences", permanent: true },
      { source: "/services/supercar-self-drive", destination: "/supercar-hire", permanent: true },
      { source: "/services/:slug", destination: "/chauffeur-services/:slug", permanent: true },
    ];
  },
  images: {
    // 80 is where AVIF and WebP stop showing a visible difference on this
    // photography; above it the bytes grow much faster than the quality.
    qualities: [75, 80],
    // AVIF first: typically 20–30% smaller than WebP at the same quality on
    // photographic content, which is all this site serves. WebP is the
    // fallback for anything that cannot take it.
    formats: ["image/avif", "image/webp"],
    // A year — the filenames are content-hashed by the optimiser, so a
    // changed photograph produces a new URL rather than a stale cache.
    minimumCacheTTL: 31_536_000,
    // A year-long cache still needs a ceiling. The least recently used
    // variants are dropped first once it is reached.
    maximumDiskCacheSize: 1_000_000_000,
    /**
     * Interior-page heroes are imported from `public/`. Every other
     * photograph — the admin's uploads included — lives in the R2 bucket, so
     * that is the one remote origin allowed. See `packages/env/src/images.ts`
     * for why nothing wider is.
     */
    remotePatterns: allowImagesFrom(env.MEDIA_URL),
  },
};

export default nextConfig;
