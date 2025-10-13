import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "FixAuthAPI" });

/**
 * 修复 API - 修复认证数据以解决 400 错误
 * 这个端点用于修复认证数据问题
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { saleorApiUrl, token, appId, domain } = req.body;

    if (!saleorApiUrl || !token || !appId) {
      return res.status(400).json({
        error: "Missing required fields: saleorApiUrl, token, appId",
      });
    }

    // 创建认证数据
    const authData = {
      saleorApiUrl,
      domain: domain || new URL(saleorApiUrl).hostname,
      token,
      appId,
      jwks: "{}", // 使用默认JWKS
    };

    // 保存到 APL
    await saleorApp.apl.set(authData);

    logger.info(`✅ Auth data fixed for domain: ${domain || new URL(saleorApiUrl).hostname}`);

    return res.status(200).json({
      success: true,
      message: "Auth data fixed successfully",
    });
  } catch (error) {
    logger.error(
      "❌ Error fixing auth data: " + (error instanceof Error ? error.message : "Unknown error"),
    );
    return res.status(500).json({ error: "Failed to fix auth data" });
  }
}
