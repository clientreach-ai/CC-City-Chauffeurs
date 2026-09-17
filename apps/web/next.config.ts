import "@CC-City-Chauffeurs/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,

  /**
   * The quote form and the booking form are one page now.
   *
   * Both addresses were live, both may have been sent to somebody, and a
   * query string carrying the service they picked has to survive the move —
   * Next keeps it, which is why neither of these names it. Permanent, because
   * the old pages are not coming back.
   */
  async redirects() {
    return [
      { source: "/request-a-quote", destination: "/request-a-chauffeur", permanent: true },
      { source: "/book", destination: "/request-a-chauffeur", permanent: true },
    ];
  },
  images: {
    // Large editorial photography is the point of this site — allow the
    // optimiser to serve the hero and featured shots above the default 75.
    qualities: [75, 85, 90],
    // AVIF first: typically 20–30% smaller than WebP at the same quality on
    // photographic content, which is all this site serves. WebP is the
    // fallback for anything that cannot take it.
    formats: ["image/avif", "image/webp"],
    // A year — the filenames are content-hashed by the optimiser, so a
    // changed photograph produces a new URL rather than a stale cache.
    minimumCacheTTL: 31_536_000,
    /**
     * The site's own photography is served from `public/`, but a photograph
     * uploaded through the admin is served by the API, which is another
     * origin.
     */
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
