import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "CreateTestAuthAPI" });

/**
 * 创建测试认证数据 API
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info("Creating test auth data");

    // 检查APL状态
    const aplConfigured = await saleorApp.apl.isConfigured();
    logger.info("APL配置状态: " + JSON.stringify(aplConfigured));

    if (!aplConfigured.configured) {
      return res.status(500).json({ 
        error: "APL not configured",
        details: aplConfigured.error?.message || "Unknown error"
      });
    }

    // 创建测试认证数据
    const testAuthData = {
      saleorApiUrl: "https://test-saleor-instance.saleor.cloud/graphql/",
      domain: "test-saleor-instance.saleor.cloud",
      token: "test-auth-token",
      appId: "test-app-id",
      jwks: "{}"
    };

    // 保存测试数据
    await saleorApp.apl.set(testAuthData);
    logger.info("Test auth data created successfully");

    // 验证数据是否保存成功
    const savedData = await saleorApp.apl.get(testAuthData.saleorApiUrl);
    logger.info("Saved data: " + JSON.stringify(savedData));

    return res.status(200).json({
      success: true,
      message: "Test auth data created successfully",
      savedData
    });
  } catch (error) {
    logger.error("创建测试认证数据时出错: " + (error instanceof Error ? error.message : "Unknown error"));
    return res.status(500).json({ 
      error: "Failed to create test auth data",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}