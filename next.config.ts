import type { NextConfig } from "next";
import { MOCK_ONLY_PATHS, demoDataEnabled } from "./lib/demo";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Phase 2: "/" should send signed-out visitors to /sign-in instead.
  async redirects() {
    // Alerts were folded into the watch list; old links land there.
    const alerts = { source: "/alerts", destination: "/watchlist", permanent: false };
    // DEMO_DATA=off: send every mock-only page to the live Market analysis.
    if (!demoDataEnabled()) {
      return [
        alerts,
        { source: "/", destination: "/market", permanent: false },
        ...MOCK_ONLY_PATHS.flatMap((p) => [
          { source: p, destination: "/market", permanent: false },
          { source: `${p}/:rest*`, destination: "/market", permanent: false },
        ]),
      ];
    }
    return [
      alerts,
      { source: "/", destination: "/home", permanent: false },
      { source: "/events", destination: "/events/slush-2026/overview", permanent: false },
      { source: "/startup", destination: "/startup/overview", permanent: false },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
