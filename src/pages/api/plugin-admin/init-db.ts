import { type NextApiRequest, type NextApiResponse } from "next";
import { requirePluginAdmin } from "../../../lib/auth/plugin-admin-auth";
import { initializeDatabase } from "../../../lib/db/turso-client";

/**
 * 数据库初始化接口
 * 只有插件管理员可以访问
 * 
 * POST /api/plugin-admin/init-db
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 验证插件管理员权限
  const hasPermission = await requirePluginAdmin(req, res);
  if (!hasPermission) {
    return; // requirePluginAdmin 已经发送了响应
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("🔄 开始初始化数据库...");
    
    await initializeDatabase();
    
    console.log("✅ 数据库初始化完成");
    
    return res.status(200).json({
      success: true,
      message: "数据库初始化成功",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ 数据库初始化失败:", error);
    
    return res.status(500).json({
      success: false,
      error: "Database initialization failed",
      message: error instanceof Error ? error.message : "未知错误",
    });
  }
}