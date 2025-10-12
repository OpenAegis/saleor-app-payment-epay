import { type NextApiRequest, type NextApiResponse } from "next";
import { gatewayManager } from "../../../lib/managers/gateway-manager";
import { CreateGatewaySchema, UpdateGatewaySchema } from "../../../lib/models/gateway";
import { requirePluginAdmin } from "../../../lib/auth/plugin-admin-auth";

/**
 * 插件管理员专用API - 支付通道管理
 * 需要通过插件管理员登录才能访问
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 验证插件管理员权限
  const hasPermission = await requirePluginAdmin(req, res);
  if (!hasPermission) {
    return; // requirePluginAdmin 已经发送了响应
  }

  try {
    switch (req.method) {
      case "GET": {
        // 获取渠道列表
        const gateways = await gatewayManager.getAll();
        return res.status(200).json({ gateways });
      }

      case "POST": {
        // 创建新通道
        const parsed = CreateGatewaySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid input", details: parsed.error });
        }

        const gateway = await gatewayManager.create(parsed.data);
        return res.status(201).json({ gateway });
      }

      case "PUT": {
        // 更新通道（管理员可以修改所有字段）
        const { id, ...data } = req.body;
        if (!id) {
          return res.status(400).json({ error: "Gateway ID is required" });
        }

        const parsed = UpdateGatewaySchema.safeParse(data);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid input", details: parsed.error });
        }

        const gateway = await gatewayManager.update(id, parsed.data);
        if (!gateway) {
          return res.status(404).json({ error: "Gateway not found" });
        }

        return res.status(200).json({ gateway });
      }

      case "DELETE": {
        // 删除通道
        const { id } = req.query;
        if (!id || typeof id !== "string") {
          return res.status(400).json({ error: "Gateway ID is required" });
        }

        const deleted = await gatewayManager.delete(id);
        if (!deleted) {
          return res.status(404).json({ error: "Gateway not found" });
        }

        return res.status(200).json({ success: true });
      }

      default:
        res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error("[插件管理员API] 通道管理错误:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
