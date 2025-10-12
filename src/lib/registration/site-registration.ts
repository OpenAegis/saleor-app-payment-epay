import { createLogger } from "../logger";
import { siteManager } from "../managers/site-manager";
import { domainWhitelistManager } from "../managers/domain-whitelist-manager";
import type { RegistrationResult } from "./types";

const logger = createLogger({ component: "SiteRegistration" });

export async function registerSiteWithAuthorization(
  saleorDomain: string,
  saleorApiUrl: string,
  clientIP?: string
): Promise<RegistrationResult> {
  try {
    logger.info(
      {
        saleorDomain,
        saleorApiUrl,
        clientIP,
      },
      "开始站点注册和授权检查"
    );

    // 注册或更新域名站点
    await registerDomainSite(saleorDomain, saleorApiUrl, clientIP);

    // 如果有客户端IP且与域名不同，同时注册IP站点
    if (clientIP && clientIP !== saleorDomain) {
      await registerIPSite(clientIP, saleorApiUrl);
    }

    // 检查站点授权
    const authorizationResult = await checkSiteAuthorization(saleorDomain, clientIP);
    if (!authorizationResult.success) {
      return authorizationResult;
    }

    // 检查白名单（如果配置了）
    const whitelistResult = await checkWhitelist(saleorDomain, clientIP);
    if (!whitelistResult.success) {
      logger.warn(whitelistResult.message);
      // 白名单检查失败不阻止注册，只记录警告
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    logger.error({ error: errorMessage }, "站点注册过程出错");
    
    return {
      success: false,
      error: "REGISTRATION_ERROR",
      message: errorMessage
    };
  }
}

async function registerDomainSite(
  saleorDomain: string, 
  saleorApiUrl: string, 
  clientIP?: string
): Promise<void> {
  const existingSite = await siteManager.getByDomain(saleorDomain);
  
  if (!existingSite) {
    logger.info(`域名站点尚未注册，开始注册: ${saleorDomain}`);
    
    await siteManager.register({
      domain: saleorDomain,
      name: `Saleor Store (${saleorDomain})`,
      saleorApiUrl,
      clientIP,
    });
    
    logger.info(`域名站点注册成功: ${saleorDomain}`);
  } else {
    logger.info(`域名站点已注册: ${saleorDomain}, 状态: ${existingSite.status}`);
    
    // 如果站点已存在但没有IP信息，更新IP
    if (clientIP && !existingSite.clientIP) {
      logger.info(`更新现有站点的IP信息: ${clientIP}`);
      await siteManager.update(existingSite.id, {
        clientIP,
      });
    }
  }
}

async function registerIPSite(clientIP: string, saleorApiUrl: string): Promise<void> {
  const existingIPSite = await siteManager.getByDomain(clientIP);
  
  if (!existingIPSite) {
    logger.info(`IP站点尚未注册，开始注册: ${clientIP}`);
    
    try {
      await siteManager.register({
        domain: clientIP,
        name: `Saleor Store IP (${clientIP})`,
        saleorApiUrl,
      });
      
      logger.info(`IP站点注册成功: ${clientIP}`);
    } catch (error) {
      logger.warn(
        { 
          ip: clientIP, 
          error: error instanceof Error ? error.message : "未知错误" 
        },
        "IP站点注册失败，但继续流程"
      );
    }
  } else {
    logger.info(`IP站点已注册: ${clientIP}, 状态: ${existingIPSite.status}`);
  }
}

async function checkSiteAuthorization(
  saleorDomain: string, 
  clientIP?: string
): Promise<RegistrationResult> {
  const isSiteAuthorized = await siteManager.isAuthorized(
    saleorDomain,
    clientIP
  );
  
  if (!isSiteAuthorized) {
    const errorMsg = `站点未被授权，拒绝安装: 域名=${saleorDomain}, IP=${clientIP || "未知"}`;
    logger.error({
      domain: saleorDomain,
      ip: clientIP,
    }, errorMsg);
    
    return {
      success: false,
      error: "UNAUTHORIZED",
      message: `未授权访问: 域名 '${saleorDomain}' 和 IP '${clientIP || "未知"}' 都未在授权列表中。记录已保存，请联系管理员审核授权。`
    };
  }
  
  return { success: true };
}

async function checkWhitelist(
  saleorDomain: string, 
  clientIP?: string
): Promise<RegistrationResult> {
  const whitelist = await domainWhitelistManager.getActive();
  
  if (whitelist.length === 0) {
    return { success: true }; // 没有白名单配置，直接通过
  }
  
  const isDomainAllowed = await domainWhitelistManager.isAllowed(saleorDomain);
  let isAllowed = isDomainAllowed;
  
  if (!isDomainAllowed && clientIP) {
    const isIPAllowed = await domainWhitelistManager.isAllowed(clientIP);
    logger.info(`域名白名单检查: ${isDomainAllowed}, IP白名单检查: ${isIPAllowed}`);
    isAllowed = isIPAllowed;
  } else {
    logger.info(`域名白名单检查: ${isDomainAllowed}`);
  }
  
  if (!isAllowed) {
    return {
      success: false,
      error: "WHITELIST_DENIED",
      message: `域名和IP都不在白名单中，需要审核: 域名=${saleorDomain}, IP=${clientIP || "未知"}`
    };
  }
  
  return { success: true };
}