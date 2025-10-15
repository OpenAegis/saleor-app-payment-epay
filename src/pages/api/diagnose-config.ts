import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";
import { env } from "../../lib/env.mjs";

const logger = createLogger({ component: "DiagnoseConfigAPI" });

/**
 * 诊断配置 API - 检查当前配置和认证状态
 * 注意：此API仅用于开发和调试目的，在生产环境中需要通过环境变量启用
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 检查是否启用了诊断接口（通过环境变量控制）
  const diagnosticsEnabled = env.CI === "true";
  if (!diagnosticsEnabled) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Diagnostics API is disabled. Only available in CI/test environment.",
    });
  }

  try {
    logger.info("Diagnose config called");

    // 检查APL配置状态
    const aplConfigured = await saleorApp.apl.isConfigured();
    logger.info("APL配置状态检查完成");

    // 获取认证数据数量（不返回具体数据）
    const allAuthData = await saleorApp.apl.getAll();
    const authDataCount = allAuthData.length;
    logger.info(`找到 ${authDataCount} 条认证数据`);

    return res.status(200).json({
      success: true,
      aplConfigured,
      authDataCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("诊断配置时出错: " + (error instanceof Error ? error.message : "Unknown error"));
    return res.status(500).json({
      error: "Failed to diagnose config",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
