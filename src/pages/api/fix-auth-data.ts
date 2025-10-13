import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "FixAuthDataAPI" });

/**
 * 修复认证数据 API - 修复占位符URL问题
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { correctSaleorApiUrl, correctDomain } = req.body as {
      correctSaleorApiUrl: string;
      correctDomain: string;
    };

    if (!correctSaleorApiUrl || !correctDomain) {
      return res.status(400).json({
        error: "Missing required fields: correctSaleorApiUrl, correctDomain",
      });
    }

    logger.info("Fixing auth data with correct URL: " + correctSaleorApiUrl);

    // 验证URL格式
    try {
      new URL(correctSaleorApiUrl);
    } catch (error) {
      logger.error("Invalid URL format: " + correctSaleorApiUrl);
      return res.status(400).json({ error: "Invalid URL format" });
    }

    // 获取所有认证数据
    const allAuthData = await saleorApp.apl.getAll();
    logger.info(`Found ${allAuthData.length} auth records to fix`);

    if (allAuthData.length === 0) {
      return res.status(404).json({ error: "No auth data found" });
    }

    // 修复每个认证数据记录
    const fixedRecords = [];
    for (const authData of allAuthData) {
      // 检查是否是占位符URL
      if (authData.saleorApiUrl.includes("your-saleor-instance.com")) {
        logger.info("Fixing placeholder URL for domain: " + authData.domain);

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
      }
    }

    return res.status(200).json({
      success: true,
      message: `Fixed ${fixedRecords.length} auth records`,
      fixedRecords,
    });
  } catch (error) {
    logger.error(
      "修复认证数据时出错: " + (error instanceof Error ? error.message : "Unknown error"),
    );
    return res.status(500).json({
      error: "Failed to fix auth data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
