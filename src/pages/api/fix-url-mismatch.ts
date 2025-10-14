import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "FixUrlMismatchAPI" });

/**
 * 修复URL不匹配问题的API
 * 当用户URL发生变化时，允许更新认证数据中的URL
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { oldUrl, newUrl, token } = req.body as {
      oldUrl: string;
      newUrl: string;
      token: string;
    };

    logger.info(`尝试修复URL不匹配: ${oldUrl} -> ${newUrl}`);

    // 验证输入
    if (!oldUrl || !newUrl) {
      return res.status(400).json({ error: "oldUrl and newUrl are required" });
    }

    // 获取所有认证数据，找到匹配的记录
    const allAuthData = await saleorApp.apl.getAll();
    logger.info(`Found ${allAuthData.length} auth records`);

    // 寻找匹配的认证数据
    let matchedAuthData = null;
    
    // 首先尝试精确匹配oldUrl
    matchedAuthData = allAuthData.find(auth => auth.saleorApiUrl === oldUrl);
    
    // 如果没有精确匹配，尝试根据token匹配
    if (!matchedAuthData && token) {
      matchedAuthData = allAuthData.find(auth => auth.token === token);
      logger.info(`Token matching result: ${matchedAuthData ? 'found' : 'not found'}`);
    }

    // 如果还没找到，尝试部分URL匹配
    if (!matchedAuthData) {
      const oldDomain = new URL(oldUrl).hostname;
      matchedAuthData = allAuthData.find(auth => {
        try {
          const authDomain = new URL(auth.saleorApiUrl).hostname;
          return authDomain === oldDomain;
        } catch {
          return false;
        }
      });
      logger.info(`Domain matching result: ${matchedAuthData ? 'found' : 'not found'}`);
    }

    if (!matchedAuthData) {
      logger.warn(`No matching auth data found for oldUrl: ${oldUrl}`);
      return res.status(404).json({ 
        error: "No matching authentication data found",
        availableUrls: allAuthData.map(auth => auth.saleorApiUrl)
      });
    }

    logger.info(`Found matching auth data with URL: ${matchedAuthData.saleorApiUrl}`);

    // 更新认证数据
    const updatedAuthData = {
      ...matchedAuthData,
      saleorApiUrl: newUrl,
    };

    // 保存更新后的认证数据
    await saleorApp.apl.set(updatedAuthData);

    // 删除旧的记录（如果URL不同）
    if (matchedAuthData.saleorApiUrl !== newUrl) {
      await saleorApp.apl.delete(matchedAuthData.saleorApiUrl);
      logger.info(`Deleted old auth data for URL: ${matchedAuthData.saleorApiUrl}`);
    }

    logger.info(`Successfully updated URL mapping: ${matchedAuthData.saleorApiUrl} -> ${newUrl}`);

    return res.status(200).json({
      success: true,
      message: "URL mapping updated successfully",
      oldUrl: matchedAuthData.saleorApiUrl,
      newUrl: newUrl,
    });

  } catch (error) {
    logger.error(
      "Error fixing URL mismatch: " + (error instanceof Error ? error.message : "Unknown error")
    );
    return res.status(500).json({
      error: "Failed to fix URL mismatch",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}