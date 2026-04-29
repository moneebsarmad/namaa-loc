import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.localhost", "*.namaalearning.com"],
  experimental: {
    serverActions: {
      allowedOrigins: ["*.localhost", "*.namaalearning.com"]
    }
  },
  transpilePackages: ["@namaa-loc/db", "@namaa-loc/ui"]
};

export default nextConfig;
