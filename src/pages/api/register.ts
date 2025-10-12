import type { NextApiRequest, NextApiResponse } from "next";
import { createAppRegisterHandler } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "../../saleor-app";
import { initializeDatabase } from "../../lib/db/turso-client";
import { createLogger } from "../../lib/logger";
import {
  extractSaleorUrlFromHeaders,
  extractRealClientIP,
  testSaleorConnection,
  discoverRealDomain,
  registerSiteWithAuthorization,
  isLocalhost,
  type RegistrationRequest,
  type RegistrationAuthData
} from "../../lib/registration";

const logger = createLogger({ component: "RegisterAPI" });

/**
 * 处理Saleor认证数据验证后的回调
 * 包含站点注册、授权检查和连接测试
 */
async function handleAuthDataVerified(
  req: any, 
  authData: any
): Promise<void> {
  logger.info(
    {
      saleorApiUrl: authData.saleorApiUrl,
      domain: authData.domain,
      appId: authData.appId,
      tokenPresent: !!authData.token,
      tokenLength: authData.token?.length,
      authDataKeys: Object.keys(authData),
      requestHeaders: {
        host: req.headers.host,
        origin: req.headers.origin,
        referer: req.headers.referer,
        'saleor-api-url': req.headers['saleor-api-url'],
        'saleor-domain': req.headers['saleor-domain'],
      },
    },
    "Saleor回调验证通过 - 开始处理认证数据"
  );

  // 尝试修正URL信息
  const correctedUrlInfo = await correctSaleorUrl(req, authData);
  if (correctedUrlInfo) {
    authData.saleorApiUrl = correctedUrlInfo.saleorApiUrl;
    authData.domain = correctedUrlInfo.domain;
  }

  // 提取客户端IP
  const clientIPResult = extractRealClientIP(req);
  const realClientIP = clientIPResult.ip;

  logger.info(
    {
      finalSaleorApiUrl: authData.saleorApiUrl,
      finalDomain: authData.domain,
      clientIP: realClientIP,
      clientIPSource: clientIPResult.source,
    },
    "准备使用的最终认证信息"
  );

  // 测试连接（非localhost）
  if (!isLocalhost(authData.saleorApiUrl)) {
    const connectionResult = await testSaleorConnection(authData.saleorApiUrl, authData.token);
    
    if (connectionResult.success) {
      logger.info(
        { connectionDetails: connectionResult.details },
        "Saleor连接测试成功"
      );
    } else {
      logger.warn(
        { 
          domain: authData.domain, 
          saleorApiUrl: authData.saleorApiUrl,
          error: connectionResult.error,
          details: connectionResult.details 
        }, 
        "Saleor连接测试失败，但继续注册流程"
      );
    }
  } else {
    logger.info("检测到localhost URL，跳过连接测试");
  }

  // 保存认证数据到APL
  await saveAuthDataToAPL(authData);

  // 注册站点并检查授权
  const registrationResult = await registerSiteWithAuthorization(
    authData.domain,
    authData.saleorApiUrl,
    realClientIP || undefined
  );
  
  if (!registrationResult.success) {
    throw new Error(registrationResult.message || "站点注册失败");
  }
}

/**
 * 修正Saleor URL信息
 * 尝试从请求头获取更准确的URL，并处理localhost域名发现
 */
async function correctSaleorUrl(
  req: any, 
  authData: any
): Promise<{ saleorApiUrl: string; domain: string } | null> {
  // 首先尝试从请求头获取更准确的URL
  const headerUrlInfo = extractSaleorUrlFromHeaders(req);
  
  if (headerUrlInfo && headerUrlInfo.saleorApiUrl !== authData.saleorApiUrl) {
    logger.info(
      {
        originalUrl: authData.saleorApiUrl,
        correctedUrl: headerUrlInfo.saleorApiUrl,
        source: headerUrlInfo.source,
      },
      "从请求头获取到更准确的URL信息"
    );
    
    return {
      saleorApiUrl: headerUrlInfo.saleorApiUrl,
      domain: headerUrlInfo.saleorDomain
    };
  }

  // 如果是localhost，尝试发现真实域名
  if (isLocalhost(authData.saleorApiUrl)) {
    const realDomainInfo = await discoverRealDomain(authData.saleorApiUrl, authData.token);
    if (realDomainInfo) {
      return realDomainInfo;
    }
  }
  
  return null;
}

/**
 * 保存认证数据到APL
 */
async function saveAuthDataToAPL(authData: any): Promise<void> {
  try {
    logger.info(
      {
        saleorApiUrl: authData.saleorApiUrl,
        domain: authData.domain,
        appId: authData.appId,
        tokenPresent: !!authData.token,
        tokenLength: authData.token?.length,
      },
      "准备保存认证数据到APL"
    );

    await saleorApp.apl.set(authData);
    
    logger.info(
      { domain: authData.domain, appId: authData.appId, saleorApiUrl: authData.saleorApiUrl },
      "认证数据已成功保存到APL",
    );

    // 验证保存是否成功
    const savedData = await saleorApp.apl.get(authData.saleorApiUrl);
    if (savedData) {
      logger.info(
        {
          retrievedDomain: savedData.domain,
          retrievedAppId: savedData.appId,
          retrievedApiUrl: savedData.saleorApiUrl,
          tokenPresent: !!savedData.token,
        },
        "APL保存验证成功"
      );
    } else {
      logger.warn("APL保存验证失败：无法检索已保存的数据");
    }
  } catch (aplError) {
    logger.error(
      { 
        error: aplError instanceof Error ? aplError.message : "未知错误",
        stack: aplError instanceof Error ? aplError.stack : undefined,
        domain: authData.domain,
        saleorApiUrl: authData.saleorApiUrl
      },
      "保存认证数据到APL失败",
    );
    throw aplError;
  }
}

/**
 * 处理手动认证令牌注册
 * 当检测到auth_token时的处理逻辑
 */
async function handleManualTokenRegistration(req: any): Promise<boolean> {
  if (!req.body?.auth_token) {
    return false;
  }
  
  logger.info("检测到auth_token，尝试手动处理注册...");
  
  try {
    const urlInfo = extractSaleorUrlFromHeaders(req);
    
    if (!urlInfo) {
      logger.error("无法从请求头中提取Saleor域名信息");
      throw new Error("无法确定Saleor实例的域名信息");
    }
    
    logger.info({
      saleorDomain: urlInfo.saleorDomain,
      saleorApiUrl: urlInfo.saleorApiUrl,
      extractedFrom: urlInfo.source
    }, "从请求头提取的域名信息");
    
    const clientIPResult = extractRealClientIP(req);
    
    // 注册站点并检查授权
    const registrationResult = await registerSiteWithAuthorization(
      urlInfo.saleorDomain,
      urlInfo.saleorApiUrl,
      clientIPResult.ip || undefined
    );
    
    if (!registrationResult.success) {
      throw new Error(registrationResult.message || "站点注册失败");
    }
    
    logger.info("手动注册流程完成");
    return true;
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : "未知错误",
      stack: error instanceof Error ? error.stack : undefined,
    }, "手动处理注册失败");
    throw error;
  }
}

/**
 * Required endpoint, called by Saleor to install app.
 * It will exchange tokens with app, so saleorApp.apl will contain token
 *
 * 增强版：同时注册站点到我们的授权系统
 */
const baseHandler = createAppRegisterHandler({
  apl: saleorApp.apl,
  // 允许所有URL，安装后通过后台管理进行授权
  allowedSaleorUrls: [
    // 总是允许安装，域名验证在注册后进行
    () => true,
  ],
  async onRequestVerified(req, { authData }) {
    await handleAuthDataVerified(req, authData);
  },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    logger.info("=== 开始处理注册请求 ===");
    
    // 确保数据库已初始化
    await initializeDatabaseSafely();

    // 记录请求信息
    logRequestInfo(req);

    // 尝试手动处理auth_token注册
    const manualHandled = await handleManualTokenRegistration(req);
    if (manualHandled) {
      return res.status(200).json({ success: true });
    }

    logger.info("准备调用baseHandler...");
    
    // 继续执行原始的Saleor注册流程
    const result = await baseHandler(req, res);
    logger.info("baseHandler执行完成");
    return result;
  } catch (error) {
    return handleRegistrationError(error, req, res);
  }
}

/**
 * 安全初始化数据库
 */
async function initializeDatabaseSafely(): Promise<void> {
  try {
    await initializeDatabase();
    logger.info("数据库初始化完成");
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "未知错误" },
      "数据库初始化失败",
    );
    // 继续执行，可能数据库已经存在
  }
}

/**
 * 记录请求信息
 */
function logRequestInfo(req: any): void {
  logger.info(
    {
      method: req.method,
      url: req.url,
      body: req.body,
      headers: {
        host: req.headers.host,
        origin: req.headers.origin,
        referer: req.headers.referer,
        "user-agent": req.headers["user-agent"],
        "x-forwarded-for": req.headers["x-forwarded-for"],
        "x-real-ip": req.headers["x-real-ip"],
        forwarded: req.headers.forwarded,
        "x-forwarded-proto": req.headers["x-forwarded-proto"],
        "x-forwarded-host": req.headers["x-forwarded-host"],
        "saleor-domain": req.headers["saleor-domain"],
        "content-type": req.headers["content-type"],
        authorization: req.headers.authorization ? "[REDACTED]" : undefined,
      },
    },
    "接收到Saleor注册请求",
  );
  
  logger.info(
    { 
      body: req.body, 
      hasAuthToken: !!(req.body && req.body.auth_token) 
    }, 
    "检查请求体"
  );
}

/**
 * 处理注册错误
 */
async function handleRegistrationError(
  error: unknown, 
  req: NextApiRequest, 
  res: NextApiResponse
): Promise<void> {
  logger.error({ 
    error: error instanceof Error ? error.message : "未知错误",
    stack: error instanceof Error ? error.stack : undefined 
  }, "注册处理器错误");
  
  // 尝试回退到基础处理器
  try {
    await baseHandler(req, res);
  } catch (handlerError) {
    logger.error({ 
      error: handlerError instanceof Error ? handlerError.message : "未知错误",
      stack: handlerError instanceof Error ? handlerError.stack : undefined 
    }, "基础注册处理器也失败了");
    
    res.status(500).json({
      error: "Registration failed",
      message: "应用注册失败，请检查网络连接和配置",
      details: handlerError instanceof Error ? handlerError.message : "未知错误"
    });
  }
}
