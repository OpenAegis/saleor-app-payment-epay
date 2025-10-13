import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "ResetAuthAPI" });

/**
 * 重置认证 API - 清除所有认证数据并重新初始化
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 获取所有认证数据
    const allAuthData = await saleorApp.apl.getAll();
    logger.info(`找到 ${allAuthData.length} 条认证数据`);

    // 删除所有认证数据
    for (const authData of allAuthData) {
      try {
        await saleorApp.apl.delete(authData.saleorApiUrl);
        logger.info(`删除认证数据: ${authData.saleorApiUrl}`);
      } catch (error) {
        logger.error(
          `删除认证数据失败 ${authData.saleorApiUrl}: ` +
            (error instanceof Error ? error.message : "Unknown error"),
        );
      }
    }

    logger.info("所有认证数据已清除");

    return res.status(200).json({
      success: true,
      message: "所有认证数据已重置",
      count: allAuthData.length,
    });
  } catch (error) {
    logger.error(
      "重置认证数据时出错: " + (error instanceof Error ? error.message : "Unknown error"),
    );
    return res.status(500).json({ error: "Failed to reset auth data" });
  }
}
