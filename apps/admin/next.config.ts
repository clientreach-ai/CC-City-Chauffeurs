import "@CC-City-Chauffeurs/env/admin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  images: {
    qualities: [75, 85, 90],
    formats: ["image/avif", "image/webp"],
    /**
     * The admin previews the website's own photography, which the website
     * serves. In development that is another port; in production another
     * subdomain — either way it is a remote host from here.
     */
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
