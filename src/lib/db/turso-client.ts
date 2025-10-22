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
        epay_rsa_private_key TEXT,
        api_version TEXT NOT NULL DEFAULT 'v1',
        sign_type TEXT NOT NULL DEFAULT 'MD5',
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

    // 2. 创建sites表（合并认证数据） - 没有外键依赖
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        saleor_api_url TEXT NOT NULL,
        client_ip TEXT,
        token TEXT,
        app_id TEXT,
        jwks TEXT,
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

    // 5. 创建order_mappings表 (订单映射) - 没有外键依赖
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS order_mappings (
        id TEXT PRIMARY KEY,
        order_no TEXT NOT NULL UNIQUE,
        order_hash TEXT NOT NULL UNIQUE,
        transaction_id TEXT NOT NULL,
        saleor_api_url TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // 创建order_mappings表的索引
    await tursoClient.execute(`
      CREATE INDEX IF NOT EXISTS order_mappings_hash_idx ON order_mappings(order_hash)
    `);

    await tursoClient.execute(`
      CREATE INDEX IF NOT EXISTS order_mappings_transaction_idx ON order_mappings(transaction_id)
    `);

    // 数据库迁移：添加新的 API 版本字段
    await migrateApiVersionFields();

    console.log("✅ 数据库表初始化成功");
  } catch (error) {
    console.error("❌ 数据库初始化失败:", error);
    throw error;
  }
}

/**
 * 数据库迁移：为 gateways 表添加 API 版本字段
 */
async function migrateApiVersionFields() {
  try {
    // 检查需要的列是否存在
    const columns = await tursoClient.execute(`PRAGMA table_info(gateways)`);
    const hasApiVersion = columns.rows.some(row => row.name === 'api_version');
    const hasSignType = columns.rows.some(row => row.name === 'sign_type');
    const hasRsaPrivateKey = columns.rows.some(row => row.name === 'epay_rsa_private_key');

    if (!hasApiVersion) {
      await tursoClient.execute(`
        ALTER TABLE gateways ADD COLUMN api_version TEXT NOT NULL DEFAULT 'v1'
      `);
      console.log("✅ 添加 api_version 字段");
    }

    if (!hasSignType) {
      await tursoClient.execute(`
        ALTER TABLE gateways ADD COLUMN sign_type TEXT NOT NULL DEFAULT 'MD5'
      `);
      console.log("✅ 添加 sign_type 字段");
    }

    if (!hasRsaPrivateKey) {
      await tursoClient.execute(`
        ALTER TABLE gateways ADD COLUMN epay_rsa_private_key TEXT
      `);
      console.log("✅ 添加 epay_rsa_private_key 字段");
    }

    if (hasApiVersion && hasSignType && hasRsaPrivateKey) {
      console.log("ℹ️ 所有 API 版本字段已存在，跳过迁移");
    }
  } catch (error) {
    console.error("❌ API 版本字段迁移失败:", error);
    // 不抛出错误，避免影响整个初始化过程
  }
}
