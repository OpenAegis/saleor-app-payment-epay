import { type NextApiRequest, type NextApiResponse } from "next";
import { tursoClient } from "../../lib/db/turso-client";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "InitSitesTableAPI" });

/**
 * 临时API用于初始化sites表 - 解决数据库结构问题
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info("开始初始化sites表...");

    // 删除现有的sites表（如果存在）
    try {
      await tursoClient.execute("DROP TABLE IF EXISTS sites");
      logger.info("已删除现有sites表");
    } catch (dropError) {
      logger.warn("删除现有表失败（可能不存在）: " + (dropError instanceof Error ? dropError.message : "Unknown"));
    }

    // 重新创建sites表（合并认证数据），确保字段完全匹配
    await tursoClient.execute(`
      CREATE TABLE sites (
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

    logger.info("sites表重新创建成功");

    // 创建索引
    await tursoClient.execute("CREATE INDEX IF NOT EXISTS sites_domain_idx ON sites(domain)");
    await tursoClient.execute("CREATE INDEX IF NOT EXISTS sites_status_idx ON sites(status)");
    logger.info("索引创建成功");

    // 测试插入一条数据确认结构正确
    const testId = "test-" + Date.now();
    await tursoClient.execute(`
      INSERT INTO sites (id, domain, name, saleor_api_url, client_ip, token, app_id, jwks, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      testId,
      "test.example.com",
      "Test Site",
      "https://test.example.com/graphql/",
      "127.0.0.1",
      "test-token",
      "test-app-id",
      "{}",
      "pending",
      "测试数据"
    ]);

    logger.info("测试插入成功");

    // 删除测试数据
    await tursoClient.execute("DELETE FROM sites WHERE id = ?", [testId]);
    logger.info("测试数据清理完成");

    return res.status(200).json({
      success: true,
      message: "Sites表初始化成功",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Sites表初始化失败: " + (error instanceof Error ? error.message : "Unknown error"));
    return res.status(500).json({
      error: "Sites table initialization failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}