import { type NextApiRequest, type NextApiResponse } from "next";
import { requirePluginAdmin } from "../../../lib/auth/plugin-admin-auth";
import { saleorApp } from "../../../saleor-app";
import { siteManager } from "../../../lib/managers/site-manager";
import { z } from "zod";
import { createLogger } from "../../../lib/logger";

const logger = createLogger({ component: "AuthManagementAPI" });

/**
 * 插件管理员专用API - 认证授权管理
 * 管理站点的认证数据关联和授权状态
 */

const UpdateAuthSchema = z.object({
  saleorApiUrl: z.string(),
  siteId: z.string().optional(),
});

const CreateAuthSchema = z.object({
  saleorApiUrl: z.string(),
  domain: z.string(),
  token: z.string(),
  appId: z.string(),
  siteId: z.string(),
  jwks: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 验证插件管理员权限
  const hasPermission = await requirePluginAdmin(req, res);
  if (!hasPermission) {
    return; // requirePluginAdmin 已经发送了响应
  }

  try {
    switch (req.method) {
      case "GET": {
        // 获取所有认证数据及其关联状态
        const { withSites } = req.query;

        if (withSites === "true") {
          // 获取包含站点信息的认证数据
          const authDataList = await saleorApp.apl.getAll();
          const enrichedData = await Promise.all(
            authDataList.map(async (authData) => {
              let site = null;
              if (authData.siteId) {
                site = await siteManager.get(authData.siteId);
              }
              return {
                ...authData,
                site,
                token: "***", // 隐藏敏感信息
              };
            }),
          );

          return res.status(200).json({ authData: enrichedData });
        } else {
          // 仅获取认证数据列表
          const authDataList = await saleorApp.apl.getAll();
          const sanitizedData = authDataList.map((data) => ({
            ...data,
            token: "***", // 隐藏敏感信息
          }));

          return res.status(200).json({ authData: sanitizedData });
        }
      }

      case "POST": {
        // 创建新的认证数据
        const parsed = CreateAuthSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid input", details: parsed.error });
        }

        const { saleorApiUrl, domain, token, appId, siteId, jwks } = parsed.data;

        // 验证站点是否存在
        const site = await siteManager.get(siteId);
        if (!site) {
          return res.status(404).json({ error: "Site not found" });
        }

        // 创建认证数据
        const authData = {
          saleorApiUrl,
          domain,
          token,
          appId,
          jwks: jwks || "{}",
          siteId,
        };

        await saleorApp.apl.set(authData);
        logger.info(`✅ 认证数据已创建: ${saleorApiUrl} -> 站点: ${siteId}`);

        return res.status(201).json({ 
          success: true, 
          message: "Auth data created successfully",
          authData: { ...authData, token: "***" }
        });
      }

      case "PUT": {
        const { action } = req.query;

        if (action === "associate") {
          // 关联认证数据到站点
          const parsed = UpdateAuthSchema.safeParse(req.body);
          if (!parsed.success) {
            return res.status(400).json({ error: "Invalid input", details: parsed.error });
          }

          const { saleorApiUrl, siteId } = parsed.data;

          // 验证认证数据是否存在
          const authData = await saleorApp.apl.get(saleorApiUrl);
          if (!authData) {
            return res.status(404).json({ error: "Auth data not found" });
          }

          // 如果提供了siteId，验证站点是否存在
          if (siteId) {
            const site = await siteManager.get(siteId);
            if (!site) {
              return res.status(404).json({ error: "Site not found" });
            }
          }

          // 更新关联
          await saleorApp.apl.updateSiteAssociation(saleorApiUrl, siteId || null);
          logger.info(`✅ 认证数据关联已更新: ${saleorApiUrl} -> ${siteId || 'null'}`);

          return res.status(200).json({ 
            success: true, 
            message: "Site association updated successfully" 
          });
        }

        if (action === "approve-site") {
          // 批准站点（同时激活认证）
          const { siteId, notes } = req.body;
          if (!siteId) {
            return res.status(400).json({ error: "Site ID is required" });
          }

          const site = await siteManager.approve(siteId, "plugin_admin", notes);
          if (!site) {
            return res.status(404).json({ error: "Site not found" });
          }

          logger.info(`✅ 站点已批准并激活认证: ${site.domain}`);
          return res.status(200).json({ 
            success: true, 
            message: "Site approved and auth activated",
            site 
          });
        }

        return res.status(400).json({ error: "Invalid action" });
      }

      case "DELETE": {
        // 删除认证数据
        const { saleorApiUrl } = req.query;
        if (!saleorApiUrl || typeof saleorApiUrl !== "string") {
          return res.status(400).json({ error: "Saleor API URL is required" });
        }

        // 检查认证数据是否存在
        const authData = await saleorApp.apl.get(saleorApiUrl);
        if (!authData) {
          return res.status(404).json({ error: "Auth data not found" });
        }

        await saleorApp.apl.delete(saleorApiUrl);
        logger.info(`✅ 认证数据已删除: ${saleorApiUrl}`);

        return res.status(200).json({ 
          success: true, 
          message: "Auth data deleted successfully" 
        });
      }

      default:
        res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    logger.error("认证管理API错误:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}