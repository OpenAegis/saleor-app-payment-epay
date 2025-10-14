import { type NextApiRequest, type NextApiResponse } from "next";
import { SALEOR_AUTHORIZATION_BEARER_HEADER, SALEOR_API_URL_HEADER } from "@saleor/app-sdk/const";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "DebugAuthAPI" });

/**
 * 临时调试端点 - 检查认证数据匹配问题
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 获取请求头
    const token = req.headers[SALEOR_AUTHORIZATION_BEARER_HEADER] as string;
    const saleorApiUrl = req.headers[SALEOR_API_URL_HEADER] as string;

    logger.info("Debug - token exists: " + !!token);
    logger.info("Debug - saleorApiUrl: " + saleorApiUrl);

    // 获取所有认证数据
    const allAuthData = await saleorApp.apl.getAll();
    logger.info("All auth data count: " + allAuthData.length);

    const debugInfo = {
      headers: {
        hasToken: !!token,
        saleorApiUrl: saleorApiUrl,
        tokenPreview: token ? token.substring(0, 50) + "..." : null,
      },
      aplData: allAuthData.map(data => ({
        saleorApiUrl: data.saleorApiUrl,
        domain: data.domain,
        appId: data.appId,
        tokenMatch: data.token === token,
        tokenPreview: data.token ? data.token.substring(0, 50) + "..." : null,
      })),
      exactMatch: null as any,
    };

    // 尝试精确匹配
    if (saleorApiUrl) {
      const exactMatch = await saleorApp.apl.get(saleorApiUrl);
      debugInfo.exactMatch = exactMatch ? {
        saleorApiUrl: exactMatch.saleorApiUrl,
        domain: exactMatch.domain,
        appId: exactMatch.appId,
        tokenMatch: exactMatch.token === token,
      } : null;
    }

    return res.status(200).json({
      success: true,
      debug: debugInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Debug auth error: " + (error instanceof Error ? error.message : "Unknown error"));
    return res.status(500).json({
      error: "Debug failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}