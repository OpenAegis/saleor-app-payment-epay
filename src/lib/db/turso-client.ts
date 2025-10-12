import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// 从环境变量读取Turso配置
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl) {
  throw new Error("TURSO_DATABASE_URL environment variable is required");
}

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
    // 创建gateways表 (支付渠道)
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

    // 创建channels表 (支付通道)
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

    // 创建sites表
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

    console.log("✅ 数据库表初始化成功");
  } catch (error) {
    console.error("❌ 数据库初始化失败:", error);
    throw error;
  }
}