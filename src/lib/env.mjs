import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables here.
   */
  server: {
    APP_URL: z.string().url().default("http://localhost:3000"),
    APP_API_BASE_URL: z.string().url().optional(),
    APP_CALLBACK_URL: z.string().url().optional(), // 回调地址（可选），用于反向代理，不填则使用 APP_URL
    TURSO_DATABASE_URL: z.string().url().default("libsql://localhost"),
    TURSO_AUTH_TOKEN: z.string().default(""),
    PLUGIN_ADMIN_USERNAME: z.string().default("admin"),
    PLUGIN_ADMIN_PASSWORD: z.string().default("admin"),
    PLUGIN_SESSION_SECRET: z.string().default("secret"),
    APP_DEBUG: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    SECRET_KEY: z.string().default("secret"),
    // 测试环境变量
    CI: z.string().optional(),
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
    APP_API_BASE_URL: process.env.APP_API_BASE_URL,
    APP_CALLBACK_URL: process.env.APP_CALLBACK_URL,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    PLUGIN_ADMIN_USERNAME: process.env.PLUGIN_ADMIN_USERNAME,
    PLUGIN_ADMIN_PASSWORD: process.env.PLUGIN_ADMIN_PASSWORD,
    PLUGIN_SESSION_SECRET: process.env.PLUGIN_SESSION_SECRET,
    APP_DEBUG: process.env.APP_DEBUG,
    SECRET_KEY: process.env.SECRET_KEY,
    CI: process.env.CI,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
