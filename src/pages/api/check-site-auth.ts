import { type NextApiRequest, type NextApiResponse } from "next";
import { siteManager } from "../../lib/managers/site-manager";
import { createLogger } from "../../lib/logger";
import { saleorApp } from "../../saleor-app";
import type { TursoAPL } from "../../lib/turso-apl";

const logger = createLogger({ component: "CheckSiteAuthAPI" });

export const config = {
  api: {
    externalResolver: true,
  },
};

/**
 * 从Authorization头提取token
 */
function extractTokenFromAuthorizationHeader(authorizationHeader: string): string | null {
  if (!authorizationHeader) return null;

  // 支持两种格式:
  // 1. "Bearer <token>"
  // 2. 直接是JWT token (用于向后兼容)
  if (authorizationHeader.startsWith("Bearer ")) {
    return authorizationHeader.substring(7); // 移除 "Bearer " 前缀
  }

  // 检查是否是JWT格式 (向后兼容)
  const parts = authorizationHeader.split(".");
  if (parts.length === 3) {
    return authorizationHeader; // 直接返回JWT
  }

  return null;
}

interface JWTPayload {
  token?: string;
  app?: string;
  [key: string]: unknown;
}

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

    // 支持两种头格式: authorization-bearer (旧格式) 和 authorization (标准格式)
    const authorizationBearerHeader = req.headers["authorization-bearer"] as string;
    const authorizationHeader = req.headers["authorization"] as string;

    // 优先使用标准的authorization头
    const authHeader = authorizationHeader || authorizationBearerHeader;

    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const saleorDomain = req.headers["saleor-domain"] as string;

    // 提取token
    const tokenFromJWT = extractTokenFromAuthorizationHeader(authHeader);
    logger.info(`Extracted token: ${tokenFromJWT ? "[REDACTED]" : "null"}`);
    if (!tokenFromJWT) {
      return res.status(401).json({ error: "Invalid authorization header format" });
    }

    // 从JWT获取app ID (如果有的话)
    let appIdFromJWT: string | undefined;
    try {
      const parts = tokenFromJWT.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString()) as JWTPayload;
        appIdFromJWT = payload?.app;
        logger.info(`Extracted app ID from JWT: ${appIdFromJWT}`);
      }
    } catch (error) {
      logger.warn(
        "Failed to decode JWT payload: " + (error instanceof Error ? error.message : "Unknown"),
      );
    }

    // 获取认证数据
    const tursoAPL = saleorApp.apl as TursoAPL;
    logger.info(`Searching for auth data with token: [REDACTED] and app ID: ${appIdFromJWT}`);
    const authData = await tursoAPL.getByToken(tokenFromJWT, appIdFromJWT);

    if (!authData) {
      logger.warn(`No auth data found for token: [REDACTED] or app ID: ${appIdFromJWT}`);
      return res.status(404).json({
        error: "No authentication data found",
        isAuthorized: false,
        status: "not_found",
      });
    }

    logger.info(`Found auth data for domain: ${authData.domain}`);

    // 获取站点信息
    const domain = saleorDomain || authData.domain;
    const clientIP =
      (req.headers["x-forwarded-for"] as string) || (req.headers["x-real-ip"] as string);

    let site = null;
    if (domain) {
      site = await siteManager.getByDomain(domain);
    }

    // 检查授权状态
    const isAuthorized = domain ? await siteManager.isAuthorized(domain, clientIP) : false;

    const response = {
      isAuthorized,
      site: site
        ? {
            id: site.id,
            domain: site.domain,
            name: site.name,
            status: site.status,
            requestedAt: site.requestedAt,
            approvedAt: site.approvedAt,
            approvedBy: site.approvedBy,
            notes: site.notes,
            lastActiveAt: site.lastActiveAt,
          }
        : null,
      authData: {
        saleorApiUrl: authData.saleorApiUrl,
        domain: authData.domain,
        appId: authData.appId,
        hasToken: !!authData.token,
        hasJwks: !!authData.jwks,
        siteId: authData.siteId,
      },
      status: site ? site.status : "no_site",
      message: getStatusMessage(isAuthorized, site?.status),
    };

    return res.status(200).json(response);
  } catch (error) {
    logger.error(
      "Error checking site auth: " + (error instanceof Error ? error.message : "Unknown error"),
    );
    return res.status(500).json({
      error: "Failed to check site authorization",
      isAuthorized: false,
      status: "error",
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
