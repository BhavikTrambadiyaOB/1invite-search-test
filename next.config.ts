import type { NextConfig } from "next";

// Template previews are served from the CDN in CDN_URL.
const cdnUrl = process.env.CDN_URL ? new URL(process.env.CDN_URL) : null

const nextConfig: NextConfig = {
  // Allow LAN access to dev assets so client components hydrate when the app is
  // opened from another device on the local network.
  allowedDevOrigins: ['192.168.0.*'],
  images: {
    remotePatterns: cdnUrl
      ? [{ protocol: cdnUrl.protocol.replace(':', '') as 'https' | 'http', hostname: cdnUrl.hostname, pathname: `${cdnUrl.pathname.replace(/\/$/, '')}/**` }]
      : [],
  },
  serverExternalPackages: ['@mastra/pg', 'pg'],
  cacheComponents: true,
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
