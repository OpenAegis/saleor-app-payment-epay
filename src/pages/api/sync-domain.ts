import { type NextApiRequest, type NextApiResponse } from "next";
import { SALEOR_API_URL_HEADER } from "@saleor/app-sdk/const";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";
import { type ExtendedAuthData, TursoAPL } from "../../lib/turso-apl";

const logger = createLogger({ component: "SyncDomainAPI" });

export const config = {
  api: {
    externalResolver: true,
  },
};

/**
 * 手动同步domain字段从URL中提取
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info("SyncDomain API called");
    logger.info("Request headers: " + JSON.stringify(req.headers));

    const authorizationHeader = req.headers["authorization-bearer"] as string;
    const requestedSaleorApiUrl = req.headers[SALEOR_API_URL_HEADER] as string;

    if (!authorizationHeader) {
      return res.status(401).json({ error: "Missing authorization-bearer header" });
    }

    if (!requestedSaleorApiUrl) {
      return res.status(400).json({ error: "Missing saleor-api-url header" });
    }

    // 从JWT获取token和app ID
    let tokenFromJWT: string;
    let appIdFromJWT: string;
    try {
      const parts = authorizationHeader.split('.');
      if (parts.length !== 3) {
        return res.status(401).json({ error: "Invalid JWT format" });
      }
      
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString()) as any;
      tokenFromJWT = payload?.token;
      appIdFromJWT = payload?.app;
      
      if (!tokenFromJWT) {
        return res.status(401).json({ error: "Invalid JWT: missing token" });
      }
    } catch (error) {
      logger.error("Failed to decode JWT: " + (error instanceof Error ? error.message : "Unknown"));
      return res.status(401).json({ error: "Invalid JWT format" });
    }

    // 获取认证数据
    const tursoAPL = saleorApp.apl as TursoAPL;
    const existingAuthData = await tursoAPL.getByToken(tokenFromJWT, appIdFromJWT);

    if (!existingAuthData) {
      return res.status(404).json({ 
        error: "No authentication data found",
        requestedUrl: requestedSaleorApiUrl
      });
    }

    // 从URL提取domain
    let newDomain: string;
    try {
      newDomain = new URL(requestedSaleorApiUrl).hostname;
      logger.info(`Extracting domain from URL: ${requestedSaleorApiUrl} -> ${newDomain}`);
    } catch (error) {
      logger.error(`Failed to extract domain from URL: ${requestedSaleorApiUrl}`);
      return res.status(400).json({ error: "Invalid URL format" });
    }

    const oldDomain = existingAuthData.domain;

    // 更新认证数据
    const updatedAuthData: ExtendedAuthData = {
      ...existingAuthData,
      domain: newDomain, // 强制更新domain
    };

    // 保存更新后的认证数据
    await saleorApp.apl.set(updatedAuthData);

    logger.info(`Domain synced: ${oldDomain} -> ${newDomain}`);

    return res.status(200).json({
      success: true,
      message: "Domain synchronized successfully",
      oldDomain: oldDomain,
      newDomain: newDomain,
      saleorApiUrl: requestedSaleorApiUrl,
    });

  } catch (error) {
    logger.error("Error syncing domain: " + (error instanceof Error ? error.message : "Unknown error"));
    return res.status(500).json({ error: "Failed to sync domain" });
  }
}

export default handler;