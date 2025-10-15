import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "DiagnoseAuthAPI" });

/**
 * 诊断 API - 检查当前认证状态
 * 注意：此API仅用于开发和调试目的，生产环境中应禁用或添加身份验证
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info("Diagnose auth called");

    // 检查APL配置状态
    const aplConfigured = await saleorApp.apl.isConfigured();
    logger.info("APL配置状态检查完成");

    // 获取认证数据数量（不返回具体数据）
    const allAuthData = await saleorApp.apl.getAll();
    const authDataCount = allAuthData.length;
    logger.info(`找到 ${authDataCount} 条认证数据`);

    // 检查文件是否存在（不返回文件内容）
    const fs = await import("fs");
    const path = await import("path");
    const authDataPath = path.join(process.cwd(), ".auth-data.json");
    const fileExists = fs.existsSync(authDataPath);

    if (fileExists) {
      logger.info("认证文件存在");
    } else {
      logger.warn("认证文件不存在: " + authDataPath);
    }

    return res.status(200).json({
      success: true,
      aplConfigured,
      authDataCount,
      fileExists,
    });
  } catch (error) {
    logger.error("诊断认证时出错: " + (error instanceof Error ? error.message : "Unknown error"));
    return res.status(500).json({
      error: "Failed to diagnose auth",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
