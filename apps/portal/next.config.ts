import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@namaa-loc/db", "@namaa-loc/ui"]
};

export default nextConfig;
