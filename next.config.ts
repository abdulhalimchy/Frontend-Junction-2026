import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Phase 2: "/" should send signed-out visitors to /sign-in instead.
  async redirects() {
    return [
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
