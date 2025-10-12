import type { NextApiRequest, NextApiResponse } from "next";
import { domainWhitelistManager } from "../../lib/managers/domain-whitelist-manager";
import { createLogger } from "../../lib/logger";
import { requirePluginAdmin } from "../../lib/auth/plugin-admin-auth";

const logger = createLogger({ component: "DomainWhitelistAPI" });

async function handleGet(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const whitelist = await domainWhitelistManager.getAll();
    return res.status(200).json({ success: true, data: whitelist });
  } catch (error) {
    logger.error("获取域名白名单失败");
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
}

async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { domainPattern, description, isActive } = req.body as {
      domainPattern: string;
      description?: string;
      isActive?: boolean;
    };

    if (!domainPattern) {
      return res.status(400).json({
        success: false,
        error: "域名模式是必填项",
      });
    }

    const record = await domainWhitelistManager.add({
      domainPattern,
      description,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    return res.status(201).json({ success: true, data: record });
  } catch (error) {
    logger.error("添加域名白名单失败");
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
}

async function handlePut(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;
    const { domainPattern, description, isActive } = req.body as {
      domainPattern?: string;
      description?: string;
      isActive?: boolean;
    };

    if (!id || typeof id !== "string") {
      return res.status(400).json({
        success: false,
        error: "ID是必填项",
      });
    }

    const record = await domainWhitelistManager.update(id, {
      domainPattern,
      description,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "未找到指定的白名单记录",
      });
    }

    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    logger.error("更新域名白名单失败");
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
}

async function handleDelete(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { id } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({
        success: false,
        error: "ID是必填项",
      });
    }

    const result = await domainWhitelistManager.delete(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "未找到指定的白名单记录",
      });
    }

    return res.status(200).json({ success: true, message: "删除成功" });
  } catch (error) {
    logger.error("删除域名白名单失败");
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
}

// 审核域名白名单
async function handleApprove(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { id } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({
        success: false,
        error: "ID是必填项",
      });
    }

    // 激活域名白名单
    const record = await domainWhitelistManager.update(id, {
      isActive: true,
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "未找到指定的白名单记录",
      });
    }

    return res.status(200).json({ success: true, data: record, message: "域名已批准" });
  } catch (error) {
    logger.error("批准域名白名单失败");
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
}

async function handleReject(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { id } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({
        success: false,
        error: "ID是必填项",
      });
    }

    // 删除拒绝的域名白名单
    const result = await domainWhitelistManager.delete(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "未找到指定的白名单记录",
      });
    }

    return res.status(200).json({ success: true, message: "域名已拒绝并删除" });
  } catch (error) {
    logger.error("拒绝域名白名单失败");
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 使用插件管理员认证验证请求
    const isAuthorized = await requirePluginAdmin(req, res);
    if (!isAuthorized) {
      return; // requirePluginAdmin 已经设置了响应
    }

    // 根据HTTP方法和路径路由请求
    const { action } = req.query;

    if (req.method === "POST" && action === "approve") {
      return await handleApprove(req, res);
    }

    if (req.method === "POST" && action === "reject") {
      return await handleReject(req, res);
    }

    // 根据HTTP方法路由请求
    switch (req.method) {
      case "GET":
        return await handleGet(req, res);
      case "POST":
        return await handlePost(req, res);
      case "PUT":
        return await handlePut(req, res);
      case "DELETE":
        return await handleDelete(req, res);
      default:
        return res.status(405).json({
          success: false,
          error: "方法不被允许",
        });
    }
  } catch (error) {
    logger.error("处理请求时发生错误");
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
}

export default handler;
