import type { NextApiRequest, NextApiResponse } from "next";
import { createAppRegisterHandler } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "../../saleor-app";
import { siteManager } from "../../lib/managers/site-manager";
import { initializeDatabase } from "../../lib/db/turso-client";
import { createLogger } from "../../lib/logger";
import { domainWhitelistManager } from "../../lib/managers/domain-whitelist-manager";

const logger = createLogger({ component: "RegisterAPI" });

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
    } catch (dbError) {
      logger.error({ error: dbError }, "数据库初始化失败");
      // 继续执行，可能数据库已经存在
    }

    // 从请求中提取Saleor信息
    const saleorApiUrl = req.headers["saleor-api-url"] as string;
    const saleorDomain = req.headers["saleor-domain"] as string;

    if (saleorApiUrl && saleorDomain) {
      logger.info({ saleorApiUrl, saleorDomain }, "尝试注册新站点");

      try {
        // 提取域名（移除协议和路径）
        const domain = new URL(`https://${saleorDomain}`).hostname;

        // 检查数据库中是否有白名单配置
        const whitelist = await domainWhitelistManager.getActive();
        if (whitelist.length === 0) {
          // 如果没有白名单配置，添加当前域名到白名单，状态设置为待定
          logger.info({ domain }, "数据库中没有白名单配置，添加默认配置");
          await domainWhitelistManager.add({
            domainPattern: domain,
            description: `自动添加的域名 - 待审核 (${new Date().toLocaleString()})`,
            isActive: false, // 设置为未激活，需要审核
          });

          // 返回安装失败，提示需要审核
          logger.warn({ domain }, "域名已添加到白名单但需要审核，拒绝安装");
          return res.status(403).json({
            success: false,
            error: {
              code: "DOMAIN_PENDING_REVIEW",
              message: "域名已提交审核，请联系管理员审核通过后再安装",
            },
          });
        }

        // 检查域名是否在白名单中
        const isDomainAllowed = await domainWhitelistManager.isAllowed(domain);
        if (!isDomainAllowed) {
          logger.warn({ domain }, "域名不在白名单中，拒绝注册");
          // 返回错误响应
          return res.status(403).json({
            success: false,
            error: {
              code: "DOMAIN_NOT_ALLOWED",
              message: "该域名未被授权安装此应用",
            },
          });
        }

        // 注册站点（包含URL验证）
        await siteManager.register({
          domain,
          name: `Saleor Store (${domain})`,
          saleorApiUrl,
        });

        logger.info({ domain, saleorApiUrl }, "站点注册成功");
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : "未知错误",
            saleorApiUrl,
            saleorDomain,
          },
          "站点注册失败",
        );

        // 如果是验证失败，返回错误但不阻止Saleor的注册流程
        // 管理员稍后可以手动处理
        if (error instanceof Error && error.message.includes("无效的 Saleor URL")) {
          logger.warn({ error: error.message }, "URL验证失败，但继续Saleor注册流程");
        }
      }
    }

    // 继续执行原始的Saleor注册流程
    return baseHandler(req, res);
  } catch (error) {
    logger.error(
      { errorMessage: error instanceof Error ? error.message : "未知错误" },
      "注册处理器错误",
    );
    return baseHandler(req, res);
  }
}
