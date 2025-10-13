import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "ResetAndReinstallAPI" });

/**
 * 重置并重新安装 API - 清除认证数据并准备重新安装
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info("Resetting auth data for reinstallation");

    // 获取所有认证数据
    const allAuthData = await saleorApp.apl.getAll();
    logger.info(`Found ${allAuthData.length} auth records to reset`);

    // 删除所有认证数据
    for (const authData of allAuthData) {
      try {
        await saleorApp.apl.delete(authData.saleorApiUrl);
        logger.info(`Deleted auth data for: ${authData.saleorApiUrl}`);
      } catch (error) {
        logger.error(
          `Failed to delete auth data for ${authData.saleorApiUrl}: ` +
            (error instanceof Error ? error.message : "Unknown error"),
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: `Reset ${allAuthData.length} auth records. Please reinstall the app in Saleor.`,
      resetCount: allAuthData.length,
    });
  } catch (error) {
    logger.error(
      "重置认证数据时出错: " + (error instanceof Error ? error.message : "Unknown error"),
    );
    return res.status(500).json({
      error: "Failed to reset auth data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
