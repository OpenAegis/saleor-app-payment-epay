import { type NextApiRequest, type NextApiResponse } from "next";
import { tursoClient } from "../../lib/db/turso-client";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "CheckAuthDataAPI" });

/**
 * 检查认证数据 API - 直接查询数据库中的认证数据
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info("Checking auth data directly from database");

    // 查询认证表中的所有数据
    const result = await tursoClient.execute(
      "SELECT * FROM saleor_auth_data"
    );
    
    logger.info(`Found ${result.rows.length} rows in auth table`);

    // 格式化数据
    const authData = result.rows.map(row => ({
      saleorApiUrl: row.saleor_api_url as string,
      domain: row.domain as string,
      token: row.token as string,
      appId: row.app_id as string,
      jwks: row.jwks as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: authData,
      rawResult: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("检查认证数据时出错: " + (error instanceof Error ? error.message : "Unknown error"));
    return res.status(500).json({ 
      error: "Failed to check auth data",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}