import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Without this, Turbopack walks up past the repo looking for a lockfile and
  // can settle on one in the parent directory.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
