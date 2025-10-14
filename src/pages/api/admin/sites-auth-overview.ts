import { type NextApiRequest, type NextApiResponse } from "next";
import { requirePluginAdmin } from "../../../lib/auth/plugin-admin-auth";
import { saleorApp } from "../../../saleor-app";
import { siteManager } from "../../../lib/managers/site-manager";
import { createLogger } from "../../../lib/logger";
import { type ExtendedAuthData } from "../../../lib/turso-apl";

const logger = createLogger({ component: "SitesAuthOverviewAPI" });

/**
 * 插件管理员专用API - 站点和认证数据概览
 * 提供站点和认证数据的联合视图
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 验证插件管理员权限
  const hasPermission = await requirePluginAdmin(req, res);
  if (!hasPermission) {
    return; // requirePluginAdmin 已经发送了响应
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // 获取所有站点
    const sites = await siteManager.getAll();
    
    // 获取所有认证数据
    const allAuthData = await saleorApp.apl.getAll();

    // 构建联合视图
    const overview = await Promise.all(
      sites.map(async (site) => {
        // 查找关联的认证数据
        const authData = allAuthData.find(auth => (auth as ExtendedAuthData).siteId === site.id) as ExtendedAuthData | undefined;
        
        return {
          site: {
            id: site.id,
            domain: site.domain,
            name: site.name,
            saleorApiUrl: site.saleorApiUrl,
            status: site.status,
            requestedAt: site.requestedAt,
            approvedAt: site.approvedAt,
            approvedBy: site.approvedBy,
            notes: site.notes,
            lastActiveAt: site.lastActiveAt,
          },
          authData: authData ? {
            saleorApiUrl: authData.saleorApiUrl,
            domain: authData.domain,
            appId: authData.appId,
            hasToken: !!authData.token,
            hasJwks: !!authData.jwks,
            siteId: authData.siteId,
          } : null,
          isAuthorized: site.status === 'approved' && !!authData,
          canActivate: site.status === 'pending' && !!authData,
          needsAuth: site.status === 'approved' && !authData,
        };
      }),
    );

    // 查找没有关联站点的认证数据（孤儿认证数据）
    const orphanedAuthData = allAuthData
      .filter(auth => !(auth as ExtendedAuthData).siteId || !sites.find(site => site.id === (auth as ExtendedAuthData).siteId))
      .map(auth => {
        const extendedAuth = auth as ExtendedAuthData;
        return ({
          site: null,
          authData: {
            saleorApiUrl: extendedAuth.saleorApiUrl,
            domain: extendedAuth.domain,
            appId: extendedAuth.appId,
            hasToken: !!extendedAuth.token,
            hasJwks: !!extendedAuth.jwks,
            siteId: extendedAuth.siteId,
          },
          isAuthorized: false,
          canActivate: false,
          needsAuth: false,
          isOrphaned: true,
        });
      });

    // 统计信息
    const stats = {
      total: {
        sites: sites.length,
        authData: allAuthData.length,
        authorized: overview.filter(item => item.isAuthorized).length,
        pending: overview.filter(item => item.canActivate).length,
        orphaned: orphanedAuthData.length,
      },
      sites: {
        pending: sites.filter(s => s.status === 'pending').length,
        approved: sites.filter(s => s.status === 'approved').length,
        rejected: sites.filter(s => s.status === 'rejected').length,
        suspended: sites.filter(s => s.status === 'suspended').length,
      },
      auth: {
        linked: allAuthData.filter(a => (a as ExtendedAuthData).siteId).length,
        unlinked: allAuthData.filter(a => !(a as ExtendedAuthData).siteId).length,
        authorized: overview.filter(item => item.isAuthorized).length,
      },
    };

    return res.status(200).json({
      overview: [...overview, ...orphanedAuthData],
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("站点认证概览API错误: " + (error instanceof Error ? error.message : "未知错误"));
    return res.status(500).json({ error: "Internal server error" });
  }
}