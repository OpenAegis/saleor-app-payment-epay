import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "AutoFixAuthAPI" });

/**
 * 自动修复认证数据 API - 自动检测并修复占位符URL
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info("Auto-fixing auth data");

    // 获取所有认证数据
    const allAuthData = await saleorApp.apl.getAll();
    logger.info(`Found ${allAuthData.length} auth records`);

    if (allAuthData.length === 0) {
      return res.status(404).json({ error: "No auth data found" });
    }

    // 修复每个认证数据记录
    const fixedRecords = [];
    let fixedCount = 0;

    for (const authData of allAuthData) {
      // 检查是否是占位符URL
      if (
        authData.saleorApiUrl.includes("your-saleor-instance.com") &&
        authData.domain &&
        authData.domain.includes("localhost")
      ) {
        logger.info("Fixing placeholder URL for domain: " + authData.domain);

        // 使用环境变量中的应用 URL
        const { env } = await import("@/lib/env.mjs");
        const appUrl = env.APP_URL;
        const correctSaleorApiUrl = `${appUrl}/graphql/`;
        const correctDomain = new URL(appUrl).hostname;

        // 创建修复后的认证数据
        const fixedAuthData = {
          ...authData,
          saleorApiUrl: correctSaleorApiUrl,
          domain: correctDomain,
        };

        // 保存修复后的数据
        await saleorApp.apl.set(fixedAuthData);
        logger.info("Fixed auth data for domain: " + correctDomain);

        // 如果URL已更改，删除旧的记录
        if (authData.saleorApiUrl !== correctSaleorApiUrl) {
          await saleorApp.apl.delete(authData.saleorApiUrl);
          logger.info("Deleted old auth record: " + authData.saleorApiUrl);
        }

        fixedRecords.push(fixedAuthData);
        fixedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Auto-fixed ${fixedCount} auth records`,
      fixedRecords,
    });
  } catch (error) {
    logger.error(
      "自动修复认证数据时出错: " + (error instanceof Error ? error.message : "Unknown error"),
    );
    return res.status(500).json({
      error: "Failed to auto-fix auth data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
