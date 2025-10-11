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
    // 创建channels表
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        priority INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // 创建gateways表
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS gateways (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        icon TEXT,
        pid TEXT NOT NULL,
        key TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        priority INTEGER NOT NULL DEFAULT 0,
        is_mandatory INTEGER NOT NULL DEFAULT 0,
        allowed_users TEXT NOT NULL DEFAULT '[]',
        is_global INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
      )
    `);

    // 创建索引
    await tursoClient.execute(`
      CREATE INDEX IF NOT EXISTS gateway_channel_idx ON gateways(channel_id)
    `);
    
    await tursoClient.execute(`
      CREATE INDEX IF NOT EXISTS gateway_type_idx ON gateways(type)
    `);

    console.log("✅ 数据库表初始化成功");
  } catch (error) {
    console.error("❌ 数据库初始化失败:", error);
    throw error;
  }
}