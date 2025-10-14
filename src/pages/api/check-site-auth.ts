import { type NextApiRequest, type NextApiResponse } from "next";
import { SALEOR_API_URL_HEADER } from "@saleor/app-sdk/const";
import { siteManager } from "../../lib/managers/site-manager";
import { createLogger } from "../../lib/logger";
import { saleorApp } from "../../saleor-app";
import { type ExtendedAuthData, TursoAPL } from "../../lib/turso-apl";

const logger = createLogger({ component: "CheckSiteAuthAPI" });

export const config = {
  api: {
    externalResolver: true,
  },
};

/**
 * 检查当前站点的授权状态
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info("CheckSiteAuth API called");
    logger.info("Request headers: " + JSON.stringify(req.headers));

    const authorizationHeader = req.headers["authorization-bearer"] as string;
    const saleorApiUrl = req.headers[SALEOR_API_URL_HEADER] as string;
    const saleorDomain = req.headers["saleor-domain"] as string;

    if (!authorizationHeader) {
      return res.status(401).json({ error: "Missing authorization-bearer header" });
    }

    if (!saleorApiUrl) {
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
    const authData = await tursoAPL.getByToken(tokenFromJWT, appIdFromJWT);

    if (!authData) {
      return res.status(404).json({ 
        error: "No authentication data found",
        isAuthorized: false,
        status: "not_found"
      });
    }

    // 获取站点信息
    const domain = saleorDomain || authData.domain;
    const clientIP = req.headers['x-forwarded-for'] as string || req.headers['x-real-ip'] as string;

    let site = null;
    if (domain) {
      site = await siteManager.getByDomain(domain);
    }

    // 检查授权状态
    const isAuthorized = domain ? await siteManager.isAuthorized(domain, clientIP) : false;

    const response = {
      isAuthorized,
      site: site ? {
        id: site.id,
        domain: site.domain,
        name: site.name,
        status: site.status,
        requestedAt: site.requestedAt,
        approvedAt: site.approvedAt,
        approvedBy: site.approvedBy,
        notes: site.notes,
        lastActiveAt: site.lastActiveAt,
      } : null,
      authData: {
        saleorApiUrl: authData.saleorApiUrl,
        domain: authData.domain,
        appId: authData.appId,
        hasToken: !!authData.token,
        hasJwks: !!authData.jwks,
        siteId: authData.siteId,
      },
      status: site ? site.status : "no_site",
      message: getStatusMessage(isAuthorized, site?.status)
    };

    return res.status(200).json(response);

  } catch (error) {
    logger.error("Error checking site auth: " + (error instanceof Error ? error.message : "Unknown error"));
    return res.status(500).json({ 
      error: "Failed to check site authorization",
      isAuthorized: false,
      status: "error"
    });
  }
}

function getStatusMessage(isAuthorized: boolean, siteStatus?: string): string {
  if (isAuthorized) {
    return "✅ 站点已获得授权，可以正常使用插件功能";
  }

  switch (siteStatus) {
    case "pending":
      return "⏳ 站点安装申请待审批，请联系插件管理员";
    case "rejected":
      return "❌ 站点申请已被拒绝，请联系插件管理员";
    case "suspended":
      return "⏸️ 站点已被暂停使用，请联系插件管理员";
    case "approved":
      return "⚠️ 站点已批准但可能存在配置问题";
    default:
      return "⚠️ 站点尚未注册或找不到授权信息";
  }
}

export default handler;