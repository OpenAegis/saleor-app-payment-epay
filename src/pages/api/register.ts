import type { NextApiRequest, NextApiResponse } from "next";
import { createAppRegisterHandler } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "../../saleor-app";
import { siteManager } from "../../lib/managers/site-manager";
import { initializeDatabase } from "../../lib/db/turso-client";
import { createLogger } from "../../lib/logger";
import { domainWhitelistManager } from "../../lib/managers/domain-whitelist-manager";

const logger = createLogger({ component: "RegisterAPI" });

/**
 * 从请求中提取真实客户端IP
 * 考虑CDN和反向代理的情况
 */
function getRealClientIP(req: {
  headers: { [key: string]: string | string[] | undefined };
}): string | null {
  try {
    // 检查常见的HTTP头字段，这些通常由CDN或反向代理设置
    const forwardedFor = req.headers["x-forwarded-for"];
    if (forwardedFor) {
      // x-forwarded-for 可能包含多个IP，第一个通常是最原始的客户端IP
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      if (typeof ips === "string") {
        const firstIP = ips.split(",")[0].trim();
        if (firstIP) {
          logger.info(`从 x-forwarded-for 获取到客户端IP: ${firstIP}`);
          return firstIP;
        }
      }
    }

    // 检查其他可能的头字段
    const realIP = req.headers["x-real-ip"];
    if (realIP) {
      const ip = Array.isArray(realIP) ? realIP[0] : realIP;
      if (typeof ip === "string") {
        logger.info(`从 x-real-ip 获取到客户端IP: ${ip}`);
        return ip;
      }
    }

    const forwarded = req.headers["forwarded"];
    if (forwarded) {
      // forwarded 格式: "for=192.0.2.60;proto=http;by=203.0.113.43"
      const forwardedStr =
        typeof forwarded === "string" ? forwarded : Array.isArray(forwarded) ? forwarded[0] : null;
      if (forwardedStr) {
        const match = forwardedStr.match(/for=([^;]+)/);
        if (match && match[1]) {
          logger.info(`从 forwarded 获取到客户端IP: ${match[1]}`);
          return match[1];
        }
      }
    }
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : "未知错误" },
      "提取客户端IP时出错",
    );
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
  async onRequestVerified(req, { authData }) {
    logger.info(
      {
        saleorApiUrl: authData.saleorApiUrl,
        domain: authData.domain,
        appId: authData.appId,
        token: authData.token ? "[REDACTED]" : undefined,
      },
      "Saleor回调验证通过",
    );

    try {
      // 从authData中提取Saleor信息
      const saleorApiUrl = authData.saleorApiUrl; // e.g. "https://api.lzsm.shop/graphql/"
      const saleorDomain = new URL(saleorApiUrl).hostname; // e.g. "api.lzsm.shop"

      // 尝试获取真实客户端IP
      const realClientIP = getRealClientIP(req);

      logger.info(
        {
          saleorApiUrl,
          saleorDomain,
          realClientIP,
        },
        "从Saleor回调中提取的信息",
      );

      // 检查站点是否已经授权（支持域名和IP两种方式）
      const isSiteAuthorized = await siteManager.isAuthorized(
        saleorDomain,
        realClientIP || undefined,
      );
      if (!isSiteAuthorized) {
        logger.warn(`站点未被授权，拒绝安装: 域名=${saleorDomain}, IP=${realClientIP || "未知"}`);
        // 注意：这里我们不直接返回错误响应，因为这是Saleor的回调处理
        // 授权检查应该在注册流程的其他部分进行
      }

      // 检查站点是否已经注册
      const existingSite = await siteManager.getByDomain(saleorDomain);
      if (!existingSite) {
        // 站点尚未注册，先注册站点
        logger.info(`站点尚未注册，开始注册: ${saleorDomain}`);

        // 注册站点（包含URL验证）
        const registeredSite = await siteManager.register({
          domain: saleorDomain,
          name: `Saleor Store (${saleorDomain})`,
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

        logger.info(`站点注册成功: ${saleorDomain} from ${saleorApiUrl}`);
      } else {
        // 站点已注册，更新信息
        logger.info(`站点已注册: ${saleorDomain}, 状态: ${existingSite.status}`);

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
      }

      // 检查数据库中是否有白名单配置（作为额外的安全层）
      const whitelist = await domainWhitelistManager.getActive();
      if (whitelist.length > 0) {
        // 如果有白名单配置，检查域名或IP是否在白名单中
        const isDomainAllowed = await domainWhitelistManager.isAllowed(saleorDomain);

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
            `域名和IP都不在白名单中，需要审核: 域名=${saleorDomain}, IP=${realClientIP || "未知"}`,
          );
          // 注意：这里我们不直接返回错误响应，因为这是Saleor的回调处理
          // 白名单检查应该在注册流程的其他部分进行
        }
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : "未知错误" },
        "处理Saleor回调时出错",
      );
    }
  },
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

    // 添加详细的请求头日志
    logger.info(
      {
        headers: {
          host: req.headers["host"],
          origin: req.headers["origin"],
          referer: req.headers["referer"],
          "user-agent": req.headers["user-agent"],
          "x-forwarded-for": req.headers["x-forwarded-for"],
          "x-real-ip": req.headers["x-real-ip"],
          forwarded: req.headers["forwarded"],
          "x-forwarded-proto": req.headers["x-forwarded-proto"],
          "x-forwarded-host": req.headers["x-forwarded-host"],
          domain: req.headers["domain"], // Saleor传递的域名
        },
        allHeaders: JSON.stringify(req.headers),
      },
      "接收到的完整请求头信息",
    );

    // 继续执行原始的Saleor注册流程
    return baseHandler(req, res);
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : "未知错误" }, "注册处理器错误");
    return baseHandler(req, res);
  }
}
