import { type NextApiRequest, type NextApiResponse } from "next";
import { isPluginAdminRequest } from "../../../lib/auth/plugin-admin-auth";

/**
 * 验证插件管理员会话
 *
 * GET /api/plugin-admin/verify
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const isAdmin = await isPluginAdminRequest(req);

  if (!isAdmin) {
    return res.status(403).json({
      authenticated: false,
      message: "未登录或会话已过期",
    });
  }

  return res.status(200).json({
    authenticated: true,
    role: "plugin_admin",
    message: "会话有效",
  });
}
