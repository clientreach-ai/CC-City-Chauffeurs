import "@CC-City-Chauffeurs/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  images: {
    // Large editorial photography is the point of this site — allow the
    // optimiser to serve the hero and featured shots above the default 75.
    qualities: [75, 85, 90],
  },
};

export default nextConfig;
