import type { NextApiRequest, NextApiResponse } from "next";
import { createAppRegisterHandler } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "../../saleor-app";
import { siteManager } from "../../lib/managers/site-manager";
import { initializeDatabase } from "../../lib/db/turso-client";
import { createLogger } from "../../lib/logger";
import { domainWhitelistManager } from "../../lib/managers/domain-whitelist-manager";
import { createClient } from "../../lib/create-graphq-client";

const logger = createLogger({ component: "RegisterAPI" });

/**
 * 检查URL是否为localhost
 */
function isLocalhost(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    return hostname === 'localhost' || 
           hostname === '127.0.0.1' || 
           hostname === '::1' ||
           hostname.endsWith('.localhost');
  } catch {
    return false;
  }
}

/**
 * 测试与Saleor实例的连接
 */
async function testSaleorConnection(saleorApiUrl: string, token: string): Promise<{
  success: boolean;
  error?: string;
  details?: any;
}> {
  try {
    logger.info(`测试连接到Saleor实例: ${saleorApiUrl}`);
    
    // 检查是否为localhost URL
    if (isLocalhost(saleorApiUrl)) {
      const warningMsg = `检测到localhost URL: ${saleorApiUrl}。部署的应用无法访问localhost，建议使用公网可访问的URL。`;
      logger.warn(warningMsg);
      return {
        success: false,
        error: "LOCALHOST_NOT_ACCESSIBLE",
        details: { 
          message: warningMsg,
          suggestion: "请使用ngrok、局域网IP或公网域名替代localhost"
        }
      };
    }

    const client = createClient(saleorApiUrl, token);

    // 尝试执行一个简单的查询来测试连接
    const query = `
      query TestConnection {
        shop {
          name
          domain {
            host
            sslEnabled
          }
        }
      }
    `;

    logger.info("开始执行GraphQL查询测试连接...");
    const result = await client.query(query, {}).toPromise();
    
    if (result.error) {
      const errorDetails = {
        message: result.error.message,
        graphQLErrors: result.error.graphQLErrors?.map(e => e.message),
        networkError: result.error.networkError?.message,
        networkErrorCode: (result.error.networkError as any)?.code,
        networkErrorErrno: (result.error.networkError as any)?.errno,
      };
      
      logger.error(errorDetails, "Saleor连接测试失败 - GraphQL错误");
      
      return {
        success: false,
        error: "GRAPHQL_ERROR",
        details: errorDetails
      };
    }

    if (result.data?.shop) {
      const shopDetails = {
        shopName: result.data.shop.name,
        domain: result.data.shop.domain?.host,
        sslEnabled: result.data.shop.domain?.sslEnabled,
      };
      
      logger.info(shopDetails, "Saleor连接测试成功");
      
      return {
        success: true,
        details: shopDetails
      };
    }

    logger.warn("Saleor连接测试返回空数据");
    return {
      success: false,
      error: "EMPTY_RESPONSE",
      details: { message: "GraphQL查询返回了空的shop数据" }
    };
    
  } catch (error) {
    const errorDetails = {
      message: error instanceof Error ? error.message : "未知错误",
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      code: (error as any)?.code,
      errno: (error as any)?.errno,
      syscall: (error as any)?.syscall,
      saleorApiUrl,
    };
    
    logger.error(errorDetails, "Saleor连接测试异常");
    
    return {
      success: false,
      error: "CONNECTION_EXCEPTION",
      details: errorDetails
    };
  }
}

/**
 * 从请求中提取真实客户端IP
 * 考虑CDN和反向代理的情况
 */
function getRealClientIP(req: {
  headers: { [key: string]: string | string[] | undefined };
}): string | null {
  try {
    // 检查常见的HTTP头字段，这些通常由CDN或反向代理设置
    const forwardedFor = req.headers["x-forwarded-for"];
    if (forwardedFor) {
      // x-forwarded-for 可能包含多个IP，第一个通常是最原始的客户端IP
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      if (typeof ips === "string") {
        const firstIP = ips.split(",")[0].trim();
        if (firstIP) {
          logger.info(`从 x-forwarded-for 获取到客户端IP: ${firstIP}`);
          return firstIP;
        }
      }
    }

    // 检查其他可能的头字段
    const realIP = req.headers["x-real-ip"];
    if (realIP) {
      const ip = Array.isArray(realIP) ? realIP[0] : realIP;
      if (typeof ip === "string") {
        logger.info(`从 x-real-ip 获取到客户端IP: ${ip}`);
        return ip;
      }
    }

    const forwarded = req.headers["forwarded"];
    if (forwarded) {
      // forwarded 格式: "for=192.0.2.60;proto=http;by=203.0.113.43"
      const forwardedStr =
        typeof forwarded === "string" ? forwarded : Array.isArray(forwarded) ? forwarded[0] : null;
      if (forwardedStr) {
        const match = forwardedStr.match(/for=([^;]+)/);
        if (match && match[1]) {
          logger.info(`从 forwarded 获取到客户端IP: ${match[1]}`);
          return match[1];
        }
      }
    }
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : "未知错误" },
      "提取客户端IP时出错",
    );
  }

  // 如果都没有找到，返回null
  return null;
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
    // 记录完整的authData调试信息
    logger.info(
      {
        // 完整的authData结构
        authData: {
          ...authData,
          token: authData.token ? "[REDACTED]" : undefined,
        },
        // authData的每个字段
        saleorApiUrl: authData.saleorApiUrl,
        domain: authData.domain,
        appId: authData.appId,
        token: authData.token ? "[REDACTED]" : undefined,
        tokenLength: authData.token?.length,
        // 检查authData是否有其他可能的URL字段
        authDataKeys: Object.keys(authData),
        
        // 请求头信息
        requestHeaders: {
          host: req.headers.host,
          origin: req.headers.origin,
          referer: req.headers.referer,
          'saleor-api-url': req.headers['saleor-api-url'],
          'saleor-domain': req.headers['saleor-domain'],
          'x-forwarded-host': req.headers['x-forwarded-host'],
          'x-forwarded-proto': req.headers['x-forwarded-proto'],
        },
        
        // 请求体信息
        requestBody: req.body,
      },
      "Saleor回调验证通过 - 开始保存认证数据",
    );

    // 尝试从请求头或其他源获取真实的Saleor URL
    let realSaleorApiUrl = authData.saleorApiUrl;
    
    // 检查请求头中是否有更准确的URL信息
    const saleorApiUrlHeader = req.headers['saleor-api-url'];
    const saleorDomainHeader = req.headers['saleor-domain'];
    const originHeader = req.headers['origin'];
    const refererHeader = req.headers['referer'];
    
    if (saleorApiUrlHeader && typeof saleorApiUrlHeader === 'string') {
      logger.info(`发现saleor-api-url请求头: ${saleorApiUrlHeader}`);
      realSaleorApiUrl = saleorApiUrlHeader;
    } else if (saleorDomainHeader && typeof saleorDomainHeader === 'string') {
      logger.info(`发现saleor-domain请求头: ${saleorDomainHeader}`);
      // 构建完整的GraphQL URL
      const protocol = saleorDomainHeader.includes('localhost') ? 'http' : 'https';
      realSaleorApiUrl = `${protocol}://${saleorDomainHeader}/graphql/`;
    } else if (originHeader && typeof originHeader === 'string' && !isLocalhost(originHeader)) {
      logger.info(`尝试从Origin请求头构建URL: ${originHeader}`);
      realSaleorApiUrl = `${originHeader}/graphql/`;
    } else if (refererHeader && typeof refererHeader === 'string' && !isLocalhost(refererHeader)) {
      logger.info(`尝试从Referer请求头构建URL: ${refererHeader}`);
      try {
        const refererUrl = new URL(refererHeader);
        realSaleorApiUrl = `${refererUrl.protocol}//${refererUrl.host}/graphql/`;
      } catch (error) {
        logger.warn(`无法解析Referer URL: ${refererHeader}`);
      }
    }
    
    if (realSaleorApiUrl !== authData.saleorApiUrl) {
      logger.info(
        {
          originalUrl: authData.saleorApiUrl,
          correctedUrl: realSaleorApiUrl,
        },
        "检测到URL差异，使用修正后的URL"
      );
      
      // 更新authData中的URL
      authData.saleorApiUrl = realSaleorApiUrl;
    }

    // 如果是localhost，尝试获取真实的域名
    if (isLocalhost(authData.saleorApiUrl)) {
      logger.info("检测到localhost URL，尝试获取真实域名信息");
      
      try {
        // 使用当前token查询shop信息来获取真实域名
        const client = createClient(authData.saleorApiUrl, authData.token);
        const domainQuery = `
          query GetShopDomain {
            shop {
              domain {
                url
                host
              }
            }
          }
        `;
        
        const domainResult = await client.query(domainQuery, {}).toPromise();
        
        if (domainResult.data?.shop?.domain?.url) {
          const realDomainUrl = domainResult.data.shop.domain.url;
          const realApiUrl = realDomainUrl.endsWith('/') 
            ? `${realDomainUrl}graphql/`
            : `${realDomainUrl}/graphql/`;
            
          logger.info(
            {
              localhost: authData.saleorApiUrl,
              realDomain: realDomainUrl,
              realApiUrl: realApiUrl,
            },
            "获取到真实域名，更新API URL"
          );
          
          // 更新为真实的API URL
          authData.saleorApiUrl = realApiUrl;
          
          // 同时更新domain字段
          try {
            const realDomainHost = new URL(realDomainUrl).hostname;
            authData.domain = realDomainHost;
            logger.info(`更新domain字段: ${realDomainHost}`);
          } catch (error) {
            logger.warn(`无法解析域名: ${realDomainUrl}`);
          }
        } else {
          logger.warn("无法从shop查询中获取域名信息");
        }
      } catch (error) {
        logger.error(
          { 
            error: error instanceof Error ? error.message : "未知错误",
            stack: error instanceof Error ? error.stack : undefined,
          },
          "查询真实域名失败，继续使用localhost"
        );
      }
    }

    // 记录最终使用的URL
    logger.info(
      { 
        finalSaleorApiUrl: authData.saleorApiUrl,
        finalDomain: authData.domain,
      },
      "准备使用的最终URL信息"
    );

    // 如果不是localhost，测试连接；否则跳过测试直接注册
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
      logger.info("仍然是localhost URL，跳过连接测试，直接进行注册");
    }

    // 尝试保存认证数据到APL
    try {
      logger.info(
        {
          beforeSave: {
            saleorApiUrl: authData.saleorApiUrl,
            domain: authData.domain,
            appId: authData.appId,
            tokenPresent: !!authData.token,
            tokenLength: authData.token?.length,
          }
        },
        "准备保存认证数据到APL"
      );

      await saleorApp.apl.set(authData);
      
      logger.info(
        { domain: authData.domain, appId: authData.appId, saleorApiUrl: authData.saleorApiUrl },
        "认证数据已成功保存到APL",
      );

      // 验证保存是否成功
      try {
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
      } catch (verifyError) {
        logger.warn(
          { error: verifyError instanceof Error ? verifyError.message : "未知错误" },
          "APL保存验证时出错"
        );
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
      throw aplError; // 重新抛出错误，这样Saleor会知道注册失败
    }

    try {
      // 从authData中提取Saleor信息
      const saleorApiUrl = authData.saleorApiUrl; // e.g. "https://api.lzsm.shop/graphql/"
      const saleorDomain = new URL(saleorApiUrl).hostname; // e.g. "api.lzsm.shop"

      // 尝试获取真实客户端IP
      const realClientIP = getRealClientIP(req);

      logger.info(
        {
          saleorApiUrl,
          saleorDomain,
          realClientIP,
        },
        "从Saleor回调中提取的信息",
      );

      // 先保存域名和IP到数据库（作为待审核记录），再检查授权

      // 检查域名站点是否已经注册
      const existingSite = await siteManager.getByDomain(saleorDomain);
      if (!existingSite) {
        // 域名站点尚未注册，先注册域名（默认为待审核状态）
        logger.info(`域名站点尚未注册，开始注册: ${saleorDomain}`);

        // 注册域名站点（包含URL验证）
        const registeredSite = await siteManager.register({
          domain: saleorDomain,
          name: `Saleor Store (${saleorDomain})`,
          saleorApiUrl,
        });

        logger.info(`域名站点注册成功: ${saleorDomain} from ${saleorApiUrl}`);
      } else {
        // 域名站点已注册，更新信息
        logger.info(`域名站点已注册: ${saleorDomain}, 状态: ${existingSite.status}`);
      }

      // 如果获取到了真实IP，同时注册IP站点
      if (realClientIP && realClientIP !== saleorDomain) {
        const existingIPSite = await siteManager.getByDomain(realClientIP);
        if (!existingIPSite) {
          logger.info(`IP站点尚未注册，开始注册: ${realClientIP}`);

          try {
            // 注册IP站点（默认为待审核状态）
            const registeredIPSite = await siteManager.register({
              domain: realClientIP,
              name: `Saleor Store IP (${realClientIP})`,
              saleorApiUrl,
            });

            logger.info(`IP站点注册成功: ${realClientIP} from ${saleorApiUrl}`);
          } catch (error) {
            logger.warn(
              { 
                ip: realClientIP, 
                error: error instanceof Error ? error.message : "未知错误" 
              },
              "IP站点注册失败，但继续流程"
            );
          }
        } else {
          logger.info(`IP站点已注册: ${realClientIP}, 状态: ${existingIPSite.status}`);
        }
      } else {
        logger.info("未获取到有效的真实客户端IP，跳过IP站点注册");
      }

      // 现在检查站点是否已经授权（支持域名和IP两种方式）
      const isSiteAuthorized = await siteManager.isAuthorized(
        saleorDomain,
        realClientIP || undefined,
      );
      if (!isSiteAuthorized) {
        const errorMsg = `站点未被授权，拒绝安装: 域名=${saleorDomain}, IP=${realClientIP || "未知"}`;
        logger.error({
          domain: saleorDomain,
          ip: realClientIP,
          saleorApiUrl,
        }, errorMsg);
        
        // 抛出错误以阻止安装，但域名和IP已经保存到数据库中待管理员审核
        throw new Error(`未授权访问: 域名 '${saleorDomain}' 和 IP '${realClientIP || "未知"}' 都未在授权列表中。记录已保存，请联系管理员审核授权。`);
      }

      // 检查数据库中是否有白名单配置（作为额外的安全层）
      const whitelist = await domainWhitelistManager.getActive();
      if (whitelist.length > 0) {
        // 如果有白名单配置，检查域名或IP是否在白名单中
        const isDomainAllowed = await domainWhitelistManager.isAllowed(saleorDomain);

        // 如果域名不在白名单中，检查真实IP是否在白名单中
        let isAllowed = isDomainAllowed;
        if (!isDomainAllowed && realClientIP) {
          const isIPAllowed = await domainWhitelistManager.isAllowed(realClientIP);
          logger.info(`域名白名单检查: ${isDomainAllowed}, IP白名单检查: ${isIPAllowed}`);
          isAllowed = isIPAllowed;
        } else {
          logger.info(`域名白名单检查: ${isDomainAllowed}`);
        }

        if (!isAllowed) {
          logger.warn(
            `域名和IP都不在白名单中，需要审核: 域名=${saleorDomain}, IP=${realClientIP || "未知"}`,
          );
          // 注意：这里我们不直接返回错误响应，因为这是Saleor的回调处理
          // 白名单检查应该在注册流程的其他部分进行
        }
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : "未知错误" },
        "处理Saleor回调时出错",
      );
    }
  },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    logger.info("=== 开始处理注册请求 ===");
    
    // 确保数据库已初始化
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

    // 添加详细的请求头日志
    logger.info(
      {
        method: req.method,
        url: req.url,
        body: req.body,
        headers: {
          host: req.headers["host"],
          origin: req.headers["origin"],
          referer: req.headers["referer"],
          "user-agent": req.headers["user-agent"],
          "x-forwarded-for": req.headers["x-forwarded-for"],
          "x-real-ip": req.headers["x-real-ip"],
          forwarded: req.headers["forwarded"],
          "x-forwarded-proto": req.headers["x-forwarded-proto"],
          "x-forwarded-host": req.headers["x-forwarded-host"],
          domain: req.headers["domain"], // Saleor传递的域名
          "content-type": req.headers["content-type"],
          authorization: req.headers["authorization"] ? "[REDACTED]" : undefined,
        },
      },
      "接收到Saleor注册请求",
    );

    logger.info("准备调用baseHandler...");
    
    // 继续执行原始的Saleor注册流程
    const result = await baseHandler(req, res);
    
    logger.info("baseHandler执行完成");
    return result;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : "未知错误",
      stack: error instanceof Error ? error.stack : undefined 
    }, "注册处理器错误");
    
    // 确保我们仍然尝试调用基础处理器
    try {
      return baseHandler(req, res);
    } catch (handlerError) {
      logger.error({ 
        error: handlerError instanceof Error ? handlerError.message : "未知错误",
        stack: handlerError instanceof Error ? handlerError.stack : undefined 
      }, "基础注册处理器也失败了");
      
      // 返回更详细的错误信息
      return res.status(500).json({
        error: "Registration failed",
        message: "应用注册失败，请检查网络连接和配置",
        details: handlerError instanceof Error ? handlerError.message : "未知错误"
      });
    }
  }
}
