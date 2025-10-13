import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "TestAuthVerificationAPI" });

/**
 * 测试认证验证 API - 诊断认证验证过程
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    logger.info("Testing auth verification process");

    // 检查APL配置
    const aplConfigured = await saleorApp.apl.isConfigured();
    logger.info("APL configured: " + JSON.stringify(aplConfigured));

    if (!aplConfigured.configured) {
      return res.status(500).json({
        error: "APL not configured",
        details: aplConfigured.error?.message || "Unknown error",
      });
    }

    // 获取所有认证数据
    const allAuthData = await saleorApp.apl.getAll();
    logger.info(`Found ${allAuthData.length} auth records`);

    if (allAuthData.length === 0) {
      return res.status(404).json({ error: "No auth data found" });
    }

    // 测试第一条认证数据
    const firstAuthData = allAuthData[0];
    logger.info("Testing with auth data: " + JSON.stringify(firstAuthData));

    // 尝试获取特定URL的认证数据
    const authData = await saleorApp.apl.get(firstAuthData.saleorApiUrl);
    logger.info("Retrieved auth data: " + JSON.stringify(authData));

    if (!authData) {
      return res.status(404).json({ error: "Auth data not found for URL" });
    }

    return res.status(200).json({
      success: true,
      message: "Auth verification test completed",
      aplConfigured,
      authData,
    });
  } catch (error) {
    logger.error(
      "认证验证测试时出错: " + (error instanceof Error ? error.message : "Unknown error"),
    );
    return res.status(500).json({
      error: "Auth verification test failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
