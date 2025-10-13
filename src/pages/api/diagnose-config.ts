import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "DiagnoseConfigAPI" });

/**
 * 诊断配置 API - 检查当前配置和认证状态
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info("Diagnose config called");

    // 检查APL配置状态
    const aplConfigured = await saleorApp.apl.isConfigured();
    logger.info("APL配置状态: " + JSON.stringify(aplConfigured));

    // 获取所有认证数据
    const allAuthData = await saleorApp.apl.getAll();
    logger.info(`找到 ${allAuthData.length} 条认证数据`);

    // 检查表结构
    try {
      const { tursoClient } = await import("../../lib/db/turso-client");
      const tableInfo = await tursoClient.execute(
        "PRAGMA table_info(saleor_auth_data)"
      );
      logger.info("Auth table structure: " + JSON.stringify(tableInfo));
    } catch (error) {
      logger.error("检查表结构时出错: " + (error instanceof Error ? error.message : "Unknown error"));
    }

    return res.status(200).json({
      success: true,
      aplConfigured,
      authDataCount: allAuthData.length,
      authData: allAuthData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("诊断配置时出错: " + (error instanceof Error ? error.message : "Unknown error"));
    return res.status(500).json({ 
      error: "Failed to diagnose config",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}