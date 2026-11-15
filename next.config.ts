import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // "/" is the landing page (app/page.tsx). proxy.ts sends signed-out visitors from app pages to /sign-in.
  async redirects() {
    return [
      // Alerts were folded into the watch list; old links land there.
      { source: "/alerts", destination: "/watchlist", permanent: false },
      { source: "/events", destination: "/events/slush-2026/overview", permanent: false },
      { source: "/startup", destination: "/startup/overview", permanent: false },
      // Home was built on fixture personas; the menu starts each side on its own page instead (ROLE_HOME).
      { source: "/home", destination: "/market", permanent: false },
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
