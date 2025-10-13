import { type NextApiRequest, type NextApiResponse } from "next";
import { tursoClient } from "../../lib/db/turso-client";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "TestTursoAPI" });

/**
 * 测试 Turso 数据库连接
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info("Testing Turso database connection");

    // 测试数据库连接
    const result = await tursoClient.execute("SELECT 1 as test");
    logger.info("Database connection test result: " + JSON.stringify(result));

    // 检查认证表是否存在
    const tableResult = await tursoClient.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='saleor_auth_data'"
    );
    const tableExists = tableResult.rows.length > 0;
    logger.info("Auth table exists: " + tableExists);

    if (tableExists) {
      // 获取表中的数据
      const dataResult = await tursoClient.execute("SELECT * FROM saleor_auth_data LIMIT 5");
      logger.info(`Found ${dataResult.rows.length} auth records`);
    }

    return res.status(200).json({
      success: true,
      message: "Turso database connection successful",
      connectionTest: result,
      tableExists,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Turso数据库测试失败: " + (error instanceof Error ? error.message : "Unknown error"));
    return res.status(500).json({ 
      error: "Failed to test Turso database",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}