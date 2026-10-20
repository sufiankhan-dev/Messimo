import path from "node:path";
import type { NextConfig } from "next";

/**
 * The app has no accounts and no server-side authorization, so a page from
 * another site must never be able to frame it and trick the user into clicking
 * an "Apply approved" confirmation. Refusing to be framed is the clickjacking
 * defense for a localhost-only application.
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["mammoth", "pdf-parse"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: path.resolve(process.cwd()),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
