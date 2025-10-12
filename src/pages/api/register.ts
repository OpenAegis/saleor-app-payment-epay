import type { NextApiRequest, NextApiResponse } from "next";
import { createAppRegisterHandler } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "../../saleor-app";
import { siteManager } from "../../lib/managers/site-manager";
import { initializeDatabase } from "../../lib/db/turso-client";
import { createLogger } from "../../lib/logger";
import { domainWhitelistManager } from "../../lib/managers/domain-whitelist-manager";

const logger = createLogger({ component: "RegisterAPI" });

/**
 * 从请求头中提取真实的基础URL
 * 考虑CDN和反向代理的情况
 */
function getRealAppBaseUrl(headers: { [key: string]: string | string[] | undefined }): string {
  // 尝试从常见的HTTP头字段中提取真实的基础URL
  const forwardedProto = headers["x-forwarded-proto"];
  const forwardedHost = headers["x-forwarded-host"];

  if (forwardedProto && forwardedHost) {
    const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
    const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
    return `${proto}://${host}`;
  }

  // 回退到host头
  const host = headers["host"];
  if (host) {
    const hostStr = Array.isArray(host) ? host[0] : host;
    // 默认使用https，除非明确指定是localhost
    const proto = hostStr.includes("localhost") ? "http" : "https";
    return `${proto}://${hostStr}`;
  }

  // 最后的回退方案
  return "https://example.com";
}

/**
 * 从请求中提取真实客户端IP
 * 考虑CDN和反向代理的情况
 */
function getRealClientIP(req: NextApiRequest): string | null {
  // 检查常见的HTTP头字段，这些通常由CDN或反向代理设置
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    // x-forwarded-for 可能包含多个IP，第一个通常是最原始的客户端IP
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const firstIP = ips.split(",")[0].trim();
    if (firstIP) {
      logger.info(`从 x-forwarded-for 获取到客户端IP: ${firstIP}`);
      return firstIP;
    }
  }

  // 检查其他可能的头字段
  const realIP = req.headers["x-real-ip"];
  if (realIP) {
    const ip = Array.isArray(realIP) ? realIP[0] : realIP;
    logger.info(`从 x-real-ip 获取到客户端IP: ${ip}`);
    return ip;
  }

  const forwarded = req.headers["forwarded"];
  if (forwarded) {
    // forwarded 格式: "for=192.0.2.60;proto=http;by=203.0.113.43"
    const match = typeof forwarded === "string" ? forwarded.match(/for=([^;]+)/) : null;
    if (match && match[1]) {
      logger.info(`从 forwarded 获取到客户端IP: ${match[1]}`);
      return match[1];
    }
  }

  // 如果都没有找到，返回null
  return null;
}

/**
 * Required endpoint, called by Saleor to install app.
 * It will exchange tokens with app, so saleorApp.apl will contain token
 *
 * 增强版：同时注册站点到我们的授权系统
 */
const baseHandler = createAppRegisterHandler({
  apl: saleorApp.apl,
  // 允许所有URL，安装后通过后台管理进行授权
  allowedSaleorUrls: [
    // 总是允许安装，域名验证在注册后进行
    () => true,
  ],
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 确保数据库已初始化
    try {
      await initializeDatabase();
      logger.info("数据库初始化完成");
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : "未知错误" },
        "数据库初始化失败",
      );
      // 继续执行，可能数据库已经存在
    }

    // 获取真实的应用基础URL
    const realAppBaseUrl = getRealAppBaseUrl(req.headers);

    // 从请求中提取Saleor信息
    const saleorApiUrl = req.headers["saleor-api-url"] as string;
    const saleorDomain = req.headers["saleor-domain"] as string;

    // 尝试获取真实客户端IP
    const realClientIP = getRealClientIP(req);

    // 添加详细的请求头日志
    logger.info(
      {
        headers: {
          "saleor-api-url": saleorApiUrl,
          "saleor-domain": saleorDomain,
          host: req.headers["host"],
          origin: req.headers["origin"],
          referer: req.headers["referer"],
          "user-agent": req.headers["user-agent"],
          "x-forwarded-for": req.headers["x-forwarded-for"],
          "x-real-ip": req.headers["x-real-ip"],
          forwarded: req.headers["forwarded"],
          "x-forwarded-proto": req.headers["x-forwarded-proto"],
          "x-forwarded-host": req.headers["x-forwarded-host"],
        },
        allHeaders: JSON.stringify(req.headers),
        realClientIP: realClientIP,
        realAppBaseUrl: realAppBaseUrl,
      },
      "接收到的完整请求头信息",
    );

    if (saleorApiUrl && saleorDomain) {
      logger.info(`尝试注册新站点: saleorApiUrl=${saleorApiUrl}, saleorDomain=${saleorDomain}`);

      try {
        // 从 saleorApiUrl 中提取域名，而不是直接使用 saleorDomain
        // saleorApiUrl 通常是完整的 URL，如 https://your-store.saleor.cloud/graphql/
        let domain: string;
        try {
          const urlObj = new URL(saleorApiUrl);
          domain = urlObj.hostname;
          logger.info(
            {
              fullUrl: saleorApiUrl,
              protocol: urlObj.protocol,
              hostname: urlObj.hostname,
              port: urlObj.port,
              pathname: urlObj.pathname,
            },
            `从 saleorApiUrl 成功提取域名: ${domain}`,
          );
        } catch (urlError) {
          logger.error(
            { error: urlError instanceof Error ? urlError.message : "未知错误" },
            `无法从 saleorApiUrl 提取域名，回退到 saleorDomain: saleorApiUrl=${saleorApiUrl}, saleorDomain=${saleorDomain}`,
          );
          // 回退到原来的逻辑
          try {
            const urlObj = new URL(`https://${saleorDomain}`);
            domain = urlObj.hostname;
            logger.info(
              {
                fullUrl: `https://${saleorDomain}`,
                protocol: urlObj.protocol,
                hostname: urlObj.hostname,
                port: urlObj.port,
              },
              `从 saleorDomain 提取域名: ${domain}`,
            );
          } catch (fallbackError) {
            logger.error(
              { error: fallbackError instanceof Error ? fallbackError.message : "未知错误" },
              `无法从 saleorDomain 提取域名，使用原始值: ${saleorDomain}`,
            );
            // 最后的回退方案
            domain = saleorDomain;
            logger.info(`使用原始 saleorDomain 值作为域名: ${domain}`);
          }
        }

        // 检查站点是否已经注册
        const existingSite = await siteManager.getByDomain(domain);
        if (!existingSite) {
          // 站点尚未注册，先注册站点
          logger.info(`站点尚未注册，开始注册: ${domain}`);

          // 注册站点（包含URL验证）
          const registeredSite = await siteManager.register({
            domain,
            name: `Saleor Store (${domain})`,
            saleorApiUrl,
          });

          // 如果我们获取到了真实IP，将其添加到站点备注中
          if (realClientIP) {
            logger.info(`更新站点备注，添加真实客户端IP: ${realClientIP}`);
            await siteManager.update(registeredSite.id, {
              notes: `真实客户端IP: ${realClientIP}${
                registeredSite.notes ? ` | ${registeredSite.notes}` : ""
              }`,
            });
          }

          logger.info(`站点注册成功: ${domain} from ${saleorApiUrl}`);
        } else {
          // 站点已注册，检查是否已授权
          logger.info(`站点已注册: ${domain}, 状态: ${existingSite.status}`);

          // 如果我们获取到了真实IP，更新站点备注
          if (realClientIP) {
            logger.info(`更新站点备注，添加真实客户端IP: ${realClientIP}`);
            const updatedNotes = `真实客户端IP: ${realClientIP}${
              existingSite.notes ? ` | ${existingSite.notes}` : ""
            }`;
            await siteManager.update(existingSite.id, {
              notes: updatedNotes,
            });
          }

          // 检查站点是否已授权
          if (existingSite.status !== "approved") {
            logger.warn(`站点未被授权，拒绝安装: ${domain}`);
            return res.status(403).json({
              success: false,
              error: {
                code: "SITE_NOT_APPROVED",
                message: "该站点未被授权安装此应用，请联系管理员审批",
              },
            });
          }
        }

        // 检查数据库中是否有白名单配置（作为额外的安全层）
        const whitelist = await domainWhitelistManager.getActive();
        if (whitelist.length > 0) {
          // 如果有白名单配置，检查域名或IP是否在白名单中
          const isDomainAllowed = await domainWhitelistManager.isAllowed(domain);

          // 如果域名不在白名单中，检查真实IP是否在白名单中
          let isAllowed = isDomainAllowed;
          if (!isDomainAllowed && realClientIP) {
            const isIPAllowed = await domainWhitelistManager.isAllowed(realClientIP);
            logger.info(`域名白名单检查: ${isDomainAllowed}, IP白名单检查: ${isIPAllowed}`);
            isAllowed = isIPAllowed;
          } else {
            logger.info(`域名白名单检查: ${isDomainAllowed}`);
          }

          if (!isAllowed) {
            logger.warn(
              `域名和IP都不在白名单中，拒绝注册: 域名=${domain}, IP=${realClientIP || "未知"}`,
            );
            // 返回错误响应
            return res.status(403).json({
              success: false,
              error: {
                code: "DOMAIN_NOT_ALLOWED",
                message: "该域名或IP地址未被授权安装此应用",
              },
            });
          }
        }
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : "未知错误" },
          "站点注册失败",
        );

        // 如果是验证失败，返回错误但不阻止Saleor的注册流程
        // 管理员稍后可以手动处理
        // 这里我们不处理具体的错误，因为错误已经在siteManager中记录了
      }
    }

    // 继续执行原始的Saleor注册流程
    return baseHandler(req, res);
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : "未知错误" }, "注册处理器错误");
    return baseHandler(req, res);
  }
}
