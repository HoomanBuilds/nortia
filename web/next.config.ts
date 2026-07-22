import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["nortia-client"],
  webpack(config) {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
