import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize package imports (tree-shake lucide, date-fns, recharts)
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "recharts"],
    proxyClientMaxBodySize: "100mb",
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  // Compress responses
  compress: true,
  // Reduce powered-by header
  poweredByHeader: false,
  // Turbopack is default in Next 16 for dev, ensure production uses SWC
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
};

export default nextConfig;
