import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables here.
   */
  server: {
    APP_URL: z.string().url(),
    TURSO_DATABASE_URL: z.string().url(),
    TURSO_AUTH_TOKEN: z.string(),
    PLUGIN_ADMIN_USERNAME: z.string(),
    PLUGIN_ADMIN_PASSWORD: z.string(),
    PLUGIN_SESSION_SECRET: z.string(),
    APP_DEBUG: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    SECRET_KEY: z.string(),
  },

  /**
   * Specify your client-side environment variables here.
   */
  client: {
    NEXT_PUBLIC_APP_NAME: z.string().default("E支付插件"),
    NEXT_PUBLIC_APP_VERSION: z.string().default("1.0.0"),
  },

  /**
   * Destructure all variables from `process.env` to make sure they aren't tree-shaken away.
   */
  runtimeEnv: {
    APP_URL: process.env.APP_URL,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    PLUGIN_ADMIN_USERNAME: process.env.PLUGIN_ADMIN_USERNAME,
    PLUGIN_ADMIN_PASSWORD: process.env.PLUGIN_ADMIN_PASSWORD,
    PLUGIN_SESSION_SECRET: process.env.PLUGIN_SESSION_SECRET,
    APP_DEBUG: process.env.APP_DEBUG,
    SECRET_KEY: process.env.SECRET_KEY,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
