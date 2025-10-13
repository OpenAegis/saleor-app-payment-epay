import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "UpdateSaleorUrlPublicAPI" });

/**
 * 公开的update-saleor-url API - 用于诊断目的
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  logger.info("UpdateSaleorUrlPublicAPI called with method: " + req.method);

  try {
    // 检查APL状态
    const aplConfigured = await saleorApp.apl.isConfigured();
    logger.info("APL配置状态: " + JSON.stringify(aplConfigured));

    if (!aplConfigured.configured) {
      return res.status(500).json({ 
        error: "APL not configured",
        details: aplConfigured.error?.message || "Unknown error"
      });
    }

    // 获取所有认证数据
    const allAuthData = await saleorApp.apl.getAll();
    logger.info(`找到 ${allAuthData.length} 条认证数据`);

    switch (req.method) {
      case "GET":
        // 如果没有认证数据，返回默认值
        if (allAuthData.length === 0) {
          return res.status(200).json({
            saleorApiUrl: "",
            isPlaceholder: true,
          });
        }

        // 使用第一个认证数据
        const firstAuthData = allAuthData[0];
        const { saleorApiUrl: currentSaleorApiUrl } = firstAuthData;

        return res.status(200).json({
          saleorApiUrl: currentSaleorApiUrl || "",
          isPlaceholder:
            !currentSaleorApiUrl || currentSaleorApiUrl.includes("your-saleor-instance.com"),
        });

      case "POST":
        return res.status(200).json({ success: true, message: "POST endpoint working" });

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    logger.error(
      "Error in update-saleor-url-public API: " + (error instanceof Error ? error.message : "未知错误"),
    );
    return res.status(500).json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};