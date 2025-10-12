import { type NextApiRequest, type NextApiResponse } from "next";
import { channelManager } from "../../../lib/managers/channel-manager";
import { CreateChannelSchema, UpdateChannelSchema } from "../../../lib/models/channel";
import { requirePluginAdmin } from "../../../lib/auth/plugin-admin-auth";

/**
 * 插件管理员专用API - 支付渠道管理
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
        const channels = await channelManager.getAll();
        return res.status(200).json({ channels });
      }

      case "POST": {
        // 创建新渠道
        const parsed = CreateChannelSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid input", details: parsed.error });
        }

        const channel = await channelManager.create(parsed.data);
        return res.status(201).json({ channel });
      }

      case "PUT": {
        // 更新渠道
        const { id, ...data } = req.body;
        if (!id) {
          return res.status(400).json({ error: "Channel ID is required" });
        }

        const parsed = UpdateChannelSchema.safeParse(data);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid input", details: parsed.error });
        }

        const channel = await channelManager.update(id, parsed.data);
        if (!channel) {
          return res.status(404).json({ error: "Channel not found" });
        }

        return res.status(200).json({ channel });
      }

      case "DELETE": {
        // 删除通道
        const { id } = req.query;
        if (!id || typeof id !== "string") {
          return res.status(400).json({ error: "Channel ID is required" });
        }

        // 删除通道（由于外键约束，删除会自动级联）
        const deleted = await channelManager.delete(id);
        if (!deleted) {
          return res.status(404).json({ error: "Channel not found" });
        }

        return res.status(200).json({ success: true });
      }

      default:
        res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error("[插件管理员API] 渠道管理错误:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}