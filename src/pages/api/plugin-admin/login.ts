import { type NextApiRequest, type NextApiResponse } from "next";
import {
  verifyCredentials,
  createSessionToken,
  setSessionCookie,
} from "../../../lib/auth/plugin-admin-auth";

/**
 * 插件管理员登录接口
 *
 * POST /api/plugin-admin/login
 * Body: { username: string, password: string }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { username, password } = req.body;

    // 验证必填字段
    if (!username || !password) {
      return res.status(400).json({
        error: "Missing credentials",
        message: "用户名和密码不能为空",
      });
    }

    // 验证凭证
    const isValid = verifyCredentials(username, password);

    if (!isValid) {
      // 延迟响应，防止暴力破解
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return res.status(401).json({
        error: "Invalid credentials",
        message: "用户名或密码错误",
      });
    }

    // 创建会话令牌
    const token = await createSessionToken();

    // 设置 Cookie
    setSessionCookie(res, token);

    return res.status(200).json({
      success: true,
      message: "登录成功",
      token, // 也返回 token，方便客户端存储
    });
  } catch (error) {
    console.error("[插件管理员登录] 错误:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "登录过程中发生错误",
    });
  }
}
