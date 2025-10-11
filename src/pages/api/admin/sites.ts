import { type NextApiRequest, type NextApiResponse } from "next";
import { siteManager } from "../../../lib/managers/site-manager";
import { requirePluginAdmin } from "../../../lib/auth/plugin-admin-auth";
import { z } from "zod";

/**
 * 插件管理员专用API - 站点授权管理
 * 需要通过插件管理员登录才能访问
 */

const ApproveRejectSchema = z.object({
  id: z.string(),
  notes: z.string().optional(),
});

const UpdateSiteSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  notes: z.string().optional(),
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
        // 获取站点列表，可以按状态筛选
        const { status } = req.query;

        let sites;
        if (status && typeof status === "string") {
          sites = await siteManager.getByStatus(status as any);
        } else {
          sites = await siteManager.getAll();
        }

        // 统计信息
        const stats = {
          total: sites.length,
          pending: sites.filter(s => s.status === "pending").length,
          approved: sites.filter(s => s.status === "approved").length,
          rejected: sites.filter(s => s.status === "rejected").length,
          suspended: sites.filter(s => s.status === "suspended").length,
        };

        return res.status(200).json({ sites, stats });
      }

      case "PUT": {
        const { action } = req.query;
        
        if (action === "approve") {
          // 批准站点
          const parsed = ApproveRejectSchema.safeParse(req.body);
          if (!parsed.success) {
            return res.status(400).json({ error: "Invalid input", details: parsed.error });
          }

          const { id, notes } = parsed.data;
          const site = await siteManager.approve(id, "plugin_admin", notes);
          
          if (!site) {
            return res.status(404).json({ error: "Site not found" });
          }

          console.log(`✅ 站点已批准: ${site.domain}`);
          return res.status(200).json({ site, message: "Site approved" });
        }

        if (action === "reject") {
          // 拒绝站点
          const parsed = ApproveRejectSchema.safeParse(req.body);
          if (!parsed.success) {
            return res.status(400).json({ error: "Invalid input", details: parsed.error });
          }

          const { id, notes } = parsed.data;
          const site = await siteManager.reject(id, "plugin_admin", notes);
          
          if (!site) {
            return res.status(404).json({ error: "Site not found" });
          }

          console.log(`❌ 站点已拒绝: ${site.domain}`);
          return res.status(200).json({ site, message: "Site rejected" });
        }

        if (action === "suspend") {
          // 暂停站点
          const parsed = ApproveRejectSchema.safeParse(req.body);
          if (!parsed.success) {
            return res.status(400).json({ error: "Invalid input", details: parsed.error });
          }

          const { id, notes } = parsed.data;
          const site = await siteManager.suspend(id, "plugin_admin", notes);
          
          if (!site) {
            return res.status(404).json({ error: "Site not found" });
          }

          console.log(`⏸️ 站点已暂停: ${site.domain}`);
          return res.status(200).json({ site, message: "Site suspended" });
        }

        if (action === "restore") {
          // 恢复站点
          const parsed = ApproveRejectSchema.safeParse(req.body);
          if (!parsed.success) {
            return res.status(400).json({ error: "Invalid input", details: parsed.error });
          }

          const { id, notes } = parsed.data;
          const site = await siteManager.restore(id, "plugin_admin", notes);
          
          if (!site) {
            return res.status(404).json({ error: "Site not found" });
          }

          console.log(`🔄 站点已恢复: ${site.domain}`);
          return res.status(200).json({ site, message: "Site restored" });
        }

        if (action === "update") {
          // 更新站点信息
          const parsed = UpdateSiteSchema.safeParse(req.body);
          if (!parsed.success) {
            return res.status(400).json({ error: "Invalid input", details: parsed.error });
          }

          const { id, ...updateData } = parsed.data;
          const site = await siteManager.update(id, updateData);
          
          if (!site) {
            return res.status(404).json({ error: "Site not found" });
          }

          return res.status(200).json({ site, message: "Site updated" });
        }

        return res.status(400).json({ error: "Invalid action" });
      }

      case "DELETE": {
        // 删除站点
        const { id } = req.query;
        if (!id || typeof id !== "string") {
          return res.status(400).json({ error: "Site ID is required" });
        }

        const deleted = await siteManager.delete(id);
        if (!deleted) {
          return res.status(404).json({ error: "Site not found" });
        }

        return res.status(200).json({ success: true, message: "Site deleted" });
      }

      default:
        res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error("[插件管理员API] 站点管理错误:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}