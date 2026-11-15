import type { NextConfig } from "next";
import { MOCK_ONLY_PATHS, demoDataEnabled } from "./lib/demo";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // "/" is the landing page (app/page.tsx). proxy.ts sends signed-out visitors from app pages to /sign-in.
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
