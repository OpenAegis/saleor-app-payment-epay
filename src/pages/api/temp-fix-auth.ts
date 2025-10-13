import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "TempFixAuthAPI" });

/**
 * 临时修复 API - 创建认证数据以解决 400 错误
 * 这是一个临时解决方案，用于在重新部署之前解决认证问题
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { saleorApiUrl, token, appId, domain } = req.body;

    if (!saleorApiUrl || !token || !appId || !domain) {
      return res.status(400).json({ 
        error: "Missing required fields: saleorApiUrl, token, appId, domain" 
      });
    }

    // 创建认证数据
    const authData = {
      saleorApiUrl,
      domain,
      token,
      appId,
      jwks: undefined,
    };

    // 保存到 APL
    await saleorApp.apl.set(authData);

    logger.info(`✅ Temporary auth data created for domain: ${domain}`);

    return res.status(200).json({
      success: true,
      message: "Temporary auth data created successfully",
    });
  } catch (error) {
    logger.error("❌ Error creating temporary auth data:", error);
    return res.status(500).json({ error: "Failed to create auth data" });
  }
}