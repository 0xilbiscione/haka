import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // OG image routes read the bundled Inter font files at runtime.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/fonts/*"],
    "/twitter-image": ["./assets/fonts/*"],
    "/stock/[code]/opengraph-image": ["./assets/fonts/*"],
    "/stock/[code]/twitter-image": ["./assets/fonts/*"],
  },
};

export default nextConfig;
