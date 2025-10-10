import { type NextApiRequest, type NextApiResponse } from "next";
import { clearSessionCookie } from "../../../lib/auth/plugin-admin-auth";

/**
 * 插件管理员登出接口
 *
 * POST /api/plugin-admin/logout
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 清除会话 Cookie
  clearSessionCookie(res);

  return res.status(200).json({
    success: true,
    message: "登出成功",
  });
}
