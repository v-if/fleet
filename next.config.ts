import type { NextConfig } from "next";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const svgrLoader = require.resolve("@svgr/webpack");

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/fleet", destination: "/", permanent: false },
      { source: "/fleet/vehicles", destination: "/vehicles", permanent: false },
      { source: "/fleet/vehicles/:id", destination: "/vehicles/:id", permanent: false },
      { source: "/fleet/map", destination: "/map", permanent: false },
      { source: "/fleet/settings", destination: "/settings", permanent: false },
    ];
  },

  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: [svgrLoader],
    });
    return config;
  },

  turbopack: {
    rules: {
      "*.svg": {
        loaders: [svgrLoader],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
