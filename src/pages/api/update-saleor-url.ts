import { type NextApiRequest, type NextApiResponse } from "next";
import { SALEOR_API_URL_HEADER } from "@saleor/app-sdk/const";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";
import type { ExtendedAuthData, TursoAPL } from "../../lib/turso-apl";

const logger = createLogger({ component: "UpdateSaleorUrlAPI" });

// 创建一个不使用认证的处理程序用于调试
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

function extractInnerAppToken(jwtToken: string): string | null {
  try {
    const parts = jwtToken.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString()) as JWTPayload;
    return typeof payload.token === "string" ? payload.token : null;
  } catch {
    return null;
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  logger.info("UpdateSaleorUrlAPI called");
  logger.info("Request headers: " + JSON.stringify(req.headers));

  // 支持两种头格式: authorization-bearer (旧格式) 和 authorization (标准格式)
  const authorizationBearerHeader = req.headers["authorization-bearer"] as string;
  const authorizationHeader = req.headers["authorization"] as string;
  const authHeader = authorizationHeader || authorizationBearerHeader;

  const requestedSaleorApiUrl = req.headers[SALEOR_API_URL_HEADER] as string;

  if (!authHeader) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  if (!requestedSaleorApiUrl) {
    return res.status(400).json({ error: "Missing saleor-api-url header" });
  }

  // 提取token
  const rawToken = extractTokenFromAuthorizationHeader(authHeader);
  if (!rawToken) {
    return res.status(401).json({ error: "Invalid authorization header format" });
  }

  // 从JWT获取app ID (如果有的话)
  let appIdFromJWT: string | undefined;
  try {
    const parts = rawToken.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString()) as JWTPayload;
      appIdFromJWT = payload?.app;
    }
  } catch (error) {
    logger.warn(
      "Failed to decode JWT payload: " + (error instanceof Error ? error.message : "Unknown"),
    );
  }

  const tokenForLookup = extractInnerAppToken(rawToken) || rawToken;

  logger.info(`Extracted from JWT - token: [REDACTED], app: ${appIdFromJWT}`);

  // 通过token查找认证数据，如果找不到则尝试通过app ID查找
  const tursoAPL = saleorApp.apl as TursoAPL;
  const existingAuthData = await tursoAPL.getByToken(tokenForLookup, appIdFromJWT);

  if (!existingAuthData) {
    logger.warn("No auth data found for provided token/app ID");
    return res.status(404).json({
      error: "No authentication data found",
      requestedUrl: requestedSaleorApiUrl,
    });
  }

  logger.info(`Found auth data for token, current URL: ${existingAuthData.saleorApiUrl}`);

  switch (req.method) {
    case "GET":
      try {
        // 总是检查并更新domain（无论URL是否改变）
        const requestedDomain = req.headers["saleor-domain"] as string;
        let domainToUpdate = requestedDomain || existingAuthData.domain;
        let urlToUpdate = existingAuthData.saleorApiUrl;
        let urlChanged = false;
        let domainChanged = false;

        // 检查URL是否需要更新
        if (requestedSaleorApiUrl && existingAuthData.saleorApiUrl !== requestedSaleorApiUrl) {
          urlToUpdate = requestedSaleorApiUrl;
          urlChanged = true;
          logger.info(
            `Auto-updating saleorApiUrl from ${existingAuthData.saleorApiUrl} to ${requestedSaleorApiUrl}`,
          );
        }

        // 总是尝试从当前URL提取domain进行同步
        if (requestedSaleorApiUrl) {
          try {
            const extractedDomain = new URL(requestedSaleorApiUrl).hostname;
            if (extractedDomain !== existingAuthData.domain) {
              domainToUpdate = extractedDomain;
              domainChanged = true;
              logger.info(
                `🔄 Auto-syncing domain from URL: ${requestedSaleorApiUrl} -> ${extractedDomain} (was: ${existingAuthData.domain})`,
              );
            }
          } catch {
            logger.warn(`Failed to extract domain from URL: ${requestedSaleorApiUrl}`);
          }
        }

        // 如果URL或domain有变化，则更新认证数据
        if (urlChanged || domainChanged) {
          const updatedAuthData: ExtendedAuthData = {
            ...existingAuthData,
            saleorApiUrl: urlToUpdate,
            domain: domainToUpdate,
          };

          // 保存新的认证数据
          await saleorApp.apl.set(updatedAuthData);

          // 如果URL改变，删除旧的记录
          if (urlChanged) {
            await saleorApp.apl.delete(existingAuthData.saleorApiUrl);
          }

          const changeLog = [];
          if (urlChanged) changeLog.push(`URL: ${existingAuthData.saleorApiUrl} -> ${urlToUpdate}`);
          if (domainChanged)
            changeLog.push(`Domain: ${existingAuthData.domain} -> ${domainToUpdate}`);

          logger.info(`Auto-updated auth data: ${changeLog.join(", ")}`);

          return res.status(200).json({
            saleorApiUrl: urlToUpdate,
            domain: domainToUpdate,
            isPlaceholder: !urlToUpdate || urlToUpdate.includes("your-saleor-instance.com"),
            autoUpdated: true,
            changes: {
              urlChanged,
              domainChanged,
              oldUrl: existingAuthData.saleorApiUrl,
              newUrl: urlToUpdate,
              oldDomain: existingAuthData.domain,
              newDomain: domainToUpdate,
            },
          });
        }

        // 如果没有变化，直接返回现有数据
        return res.status(200).json({
          saleorApiUrl: existingAuthData.saleorApiUrl,
          domain: existingAuthData.domain,
          isPlaceholder:
            !existingAuthData.saleorApiUrl ||
            existingAuthData.saleorApiUrl.includes("your-saleor-instance.com"),
          autoUpdated: false,
        });
      } catch (error) {
        logger.error(
          "Error updating Saleor URL: " + (error instanceof Error ? error.message : "未知错误"),
        );
        return res.status(500).json({ error: "Failed to update Saleor URL" });
      }

    case "POST":
      try {
        const { saleorApiUrl } = req.body as { saleorApiUrl: string };

        // 验证URL格式
        if (!saleorApiUrl) {
          logger.warn("No URL provided");
          return res.status(400).json({ error: "URL is required" });
        }

        try {
          new URL(saleorApiUrl);
        } catch (error) {
          logger.warn(
            "Invalid URL format provided: " + (error instanceof Error ? error.message : "未知错误"),
          );
          return res.status(400).json({ error: "Invalid URL format" });
        }

        // 更新认证数据中的URL
        const updatedAuthData: ExtendedAuthData = {
          ...existingAuthData,
          saleorApiUrl: saleorApiUrl,
        };

        // 保存更新后的authData
        await saleorApp.apl.set(updatedAuthData);

        // 删除旧的记录
        if (existingAuthData.saleorApiUrl !== saleorApiUrl) {
          await saleorApp.apl.delete(existingAuthData.saleorApiUrl);
        }

        logger.info(
          "Saleor API URL updated successfully: " +
            JSON.stringify({
              oldUrl: existingAuthData.saleorApiUrl,
              newUrl: saleorApiUrl,
            }),
        );

        return res.status(200).json({
          success: true,
          message: "Saleor API URL updated successfully",
          saleorApiUrl: saleorApiUrl,
        });
      } catch (error) {
        logger.error(
          "Error updating Saleor URL: " + (error instanceof Error ? error.message : "未知错误"),
        );
        return res.status(500).json({ error: "Failed to update Saleor URL" });
      }

    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

export default handler;
