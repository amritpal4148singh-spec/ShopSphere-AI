import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Product thumbnails come from the DummyJSON CDN.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.dummyjson.com" },
      { protocol: "https", hostname: "i.dummyjson.com" },
    ],
  },
};

export default nextConfig;
