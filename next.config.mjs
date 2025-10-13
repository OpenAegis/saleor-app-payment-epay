// @ts-check
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { createVanillaExtractPlugin } from "@vanilla-extract/next-plugin";
const withVanillaExtract = createVanillaExtractPlugin();
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
!process.env.SKIP_ENV_VALIDATION && (await import("./src/lib/env.mjs"));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  eslint: {
    // Skip ESLint during production builds
    ignoreDuringBuilds: true,
  },
  /** @param { import("webpack").Configuration } config */
  webpack(config, { webpack }) {
    config.experiments = { ...config.experiments, topLevelAwait: true };
    
    // Fix for 'global is not defined' error
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.DefinePlugin({
        global: 'globalThis',
      })
    );
    
    return config;
  },
  async headers() {
    return [
      {
        // Apply CORS headers to API routes
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*", // Allow all origins for Saleor app installation
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-Requested-With, saleor-api-url, saleor-domain, saleor-signature",
          },
          {
            key: "Access-Control-Max-Age",
            value: "86400",
          },
        ],
      },
    ];
  },
};

const isSentryEnabled = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

const vanillaExtractConfig = withVanillaExtract(config);

export default isSentryEnabled
  ? withSentryConfig(vanillaExtractConfig, { silent: true })
  : vanillaExtractConfig;