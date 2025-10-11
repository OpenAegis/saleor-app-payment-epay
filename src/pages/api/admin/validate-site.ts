import { NextApiRequest, NextApiResponse } from "next";
import { siteManager } from "../../../lib/managers/site-manager";
import { saleorValidator } from "../../../lib/saleor-validator";
import { createLogger } from "../../../lib/logger";
import { verifyPluginAdminSession } from "../../../lib/auth/plugin-admin-auth";

const logger = createLogger({ component: "ValidateSiteAPI" });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 验证管理员权限
    const session = await verifyPluginAdminSession(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { siteId, saleorApiUrl } = req.body;

    if (!siteId) {
      return res.status(400).json({ error: "Missing siteId" });
    }

    // 获取站点信息
    const site = await siteManager.get(siteId);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    // 使用提供的URL或站点现有的URL进行验证
    const urlToValidate = saleorApiUrl || site.saleorApiUrl;

    logger.info({ 
      siteId, 
      domain: site.domain, 
      urlToValidate,
      adminUser: session.username 
    }, "开始验证站点");

    // 验证Saleor URL
    const validation = await saleorValidator.validateSaleorUrl(urlToValidate);
    
    // 验证域名匹配
    const domainMatch = await saleorValidator.validateDomainMatch(site.domain, urlToValidate);

    const result = {
      siteId,
      domain: site.domain,
      saleorApiUrl: urlToValidate,
      validation: {
        isValid: validation.isValid,
        error: validation.error,
        shopName: validation.shopName,
        version: validation.version,
      },
      domainMatch,
      overall: validation.isValid && domainMatch,
    };

    logger.info({ 
      siteId, 
      isValid: result.overall,
      adminUser: session.username 
    }, "站点验证完成");

    // 如果提供了新的URL且验证通过，更新站点信息
    if (saleorApiUrl && result.overall && saleorApiUrl !== site.saleorApiUrl) {
      await siteManager.update(siteId, {
        saleorApiUrl: saleorApiUrl,
        notes: `URL updated by admin ${session.username}`,
      });
      
      logger.info({ siteId, newUrl: saleorApiUrl }, "站点URL已更新");
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error({ error }, "站点验证API错误");
    return res.status(500).json({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}