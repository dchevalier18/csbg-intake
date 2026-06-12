import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  experimental: {
    serverActions: {
      // spreadsheet imports arrive base64-encoded through a server action (4 MB file cap)
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
