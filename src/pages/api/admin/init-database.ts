import { type NextApiRequest, type NextApiResponse } from "next";
import { requirePluginAdmin } from "../../../lib/auth/plugin-admin-auth";
import { initializeDatabase } from "../../../lib/db/turso-client";

/**
 * 插件管理员专用API - 数据库初始化
 * 需要通过插件管理员登录才能访问
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 验证插件管理员权限
  const hasPermission = await requirePluginAdmin(req, res);
  if (!hasPermission) {
    return; // requirePluginAdmin 已经发送了响应
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    console.log("[插件管理员API] 开始数据库初始化");
    
    // 执行数据库初始化，包括表创建和字段迁移
    await initializeDatabase();
    
    console.log("[插件管理员API] 数据库初始化完成");
    
    return res.status(200).json({ 
      success: true, 
      message: "数据库初始化成功，新字段已添加" 
    });
  } catch (error) {
    console.error("[插件管理员API] 数据库初始化错误:", error);
    return res.status(500).json({ 
      error: "数据库初始化失败", 
      details: error instanceof Error ? error.message : "未知错误" 
    });
  }
}