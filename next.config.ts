import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating Next.js dev-tools badge (bottom-left) during development.
  devIndicators: false,
  async redirects() {
    return [{ source: "/", destination: "/projects", permanent: false }]
  },
  serverExternalPackages: ["mammoth", "unpdf", "@libsql/client", "libsql"],
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
  },
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
