import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "../env.mjs";
import * as schema from "./schema";

// 从环境变量读取Turso配置
const tursoUrl = env.TURSO_DATABASE_URL;
const tursoAuthToken = env.TURSO_AUTH_TOKEN;

// 创建Turso客户端
export const tursoClient = createClient({
  url: tursoUrl,
  authToken: tursoAuthToken, // 本地开发时可以为空
});

// 创建Drizzle数据库实例
export const db = drizzle(tursoClient, { schema });

// 导出类型
export type Database = typeof db;
export { schema };

/**
 * 初始化数据库表（仅在需要时调用）
 */
export async function initializeDatabase() {
  try {
    // 按正确的顺序创建表，确保外键引用的表先创建

    // 1. 创建gateways表 (支付渠道) - 没有外键依赖
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS gateways (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        epay_url TEXT NOT NULL,
        epay_pid TEXT NOT NULL,
        epay_key TEXT NOT NULL,
        icon TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        priority INTEGER NOT NULL DEFAULT 0,
        is_mandatory INTEGER NOT NULL DEFAULT 0,
        allowed_users TEXT NOT NULL DEFAULT '[]',
        is_global INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // 2. 创建sites表 - 没有外键依赖
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        saleor_api_url TEXT NOT NULL,
        app_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        requested_at TEXT NOT NULL DEFAULT (datetime('now')),
        approved_at TEXT,
        approved_by TEXT,
        notes TEXT,
        last_active_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // 3. 创建domain_whitelist表 - 没有外键依赖
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS domain_whitelist (
        id TEXT PRIMARY KEY,
        domain_pattern TEXT NOT NULL UNIQUE,
        description TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // 4. 创建channels表 (支付通道) - 依赖gateways表
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        gateway_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        icon TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        priority INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (gateway_id) REFERENCES gateways(id) ON DELETE CASCADE
      )
    `);

    // 创建索引
    await tursoClient.execute(`
      CREATE INDEX IF NOT EXISTS channel_gateway_idx ON channels(gateway_id)
    `);

    await tursoClient.execute(`
      CREATE INDEX IF NOT EXISTS channel_type_idx ON channels(type)
    `);

    await tursoClient.execute(`
      CREATE INDEX IF NOT EXISTS sites_domain_idx ON sites(domain)
    `);

    await tursoClient.execute(`
      CREATE INDEX IF NOT EXISTS sites_status_idx ON sites(status)
    `);

    await tursoClient.execute(`
      CREATE INDEX IF NOT EXISTS domain_whitelist_pattern_idx ON domain_whitelist(domain_pattern)
    `);

    console.log("✅ 数据库表初始化成功");
  } catch (error) {
    console.error("❌ 数据库初始化失败:", error);
    throw error;
  }
}
