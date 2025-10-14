import { type NextApiRequest, type NextApiResponse } from "next";
import { SALEOR_API_URL_HEADER } from "@saleor/app-sdk/const";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";
import { type ExtendedAuthData, TursoAPL } from "../../lib/turso-apl";
import { siteManager } from "../../lib/managers/site-manager";

const logger = createLogger({ component: "UpdateSiteNameAPI" });

export const config = {
  api: {
    externalResolver: true,
  },
};

/**
 * 更新站点名称
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info("UpdateSiteName API called");
    logger.info("Request headers: " + JSON.stringify(req.headers));

    const authorizationHeader = req.headers["authorization-bearer"] as string;
    const { siteName } = req.body;

    if (!authorizationHeader) {
      return res.status(401).json({ error: "Missing authorization-bearer header" });
    }

    if (typeof siteName !== "string") {
      return res.status(400).json({ error: "Missing or invalid siteName" });
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
    const authData = await tursoAPL.getByToken(tokenFromJWT, appIdFromJWT);

    if (!authData || !authData.siteId) {
      return res.status(404).json({ 
        error: "No site found for this authentication data"
      });
    }

    // 更新站点名称
    const updatedSite = await siteManager.update(authData.siteId, {
      name: siteName.trim()
    });

    if (!updatedSite) {
      return res.status(404).json({ error: "Site not found" });
    }

    logger.info(`Site name updated for site ID: ${authData.siteId}, new name: "${siteName}"`);

    return res.status(200).json({
      success: true,
      message: "Site name updated successfully",
      site: {
        id: updatedSite.id,
        domain: updatedSite.domain,
        name: updatedSite.name,
        status: updatedSite.status,
      }
    });

  } catch (error) {
    logger.error("Error updating site name: " + (error instanceof Error ? error.message : "Unknown error"));
    return res.status(500).json({ error: "Failed to update site name" });
  }
}

export default handler;