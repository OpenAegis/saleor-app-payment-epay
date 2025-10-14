import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "../../lib/db/turso-client";
import { sites } from "../../lib/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "ManualAuthUpdateAPI" });

/**
 * 手动更新认证数据的API
 * 用于修复token和URL不匹配的问题
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { newToken, newAppId, newUrl } = req.body as {
      newToken: string;
      newAppId: string;
      newUrl: string;
    };

    logger.info(`手动更新认证数据: token=${newToken}, appId=${newAppId}, url=${newUrl}`);

    // 查找placeholder记录
    const existingRecords = await db
      .select()
      .from(sites)
      .where(eq(sites.appId, "app-placeholder-id"));

    if (existingRecords.length === 0) {
      return res.status(404).json({ 
        error: "No placeholder records found",
        message: "找不到app-placeholder-id的记录"
      });
    }

    const record = existingRecords[0];
    logger.info(`找到记录: ${record.id}, 当前URL: ${record.saleorApiUrl}`);

    // 更新记录
    await db
      .update(sites)
      .set({
        token: newToken,
        appId: newAppId,
        saleorApiUrl: newUrl,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sites.id, record.id));

    logger.info(`成功更新记录: ${record.id}`);

    return res.status(200).json({
      success: true,
      message: "认证数据更新成功",
      updatedRecord: {
        id: record.id,
        oldUrl: record.saleorApiUrl,
        newUrl: newUrl,
        oldToken: record.token,
        newToken: newToken,
        oldAppId: record.appId,
        newAppId: newAppId,
      }
    });

  } catch (error) {
    logger.error(
      "手动更新认证数据失败: " + (error instanceof Error ? error.message : "Unknown error")
    );
    return res.status(500).json({
      error: "Failed to update auth data",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}