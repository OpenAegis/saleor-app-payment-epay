import { createLogger } from "../logger";
import { createClient } from "../create-graphq-client";
import { isLocalhost } from "./url-utils";
import type { ConnectionTestResult } from "./types";

const logger = createLogger({ component: "ConnectionTester" });

const TEST_QUERY = `
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

export async function testSaleorConnection(
  saleorApiUrl: string, 
  token: string
): Promise<ConnectionTestResult> {
  try {
    logger.info(`测试连接到Saleor实例: ${saleorApiUrl}`);
    
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

    logger.info("开始执行GraphQL查询测试连接...");
    const result = await client.query(TEST_QUERY, {}).toPromise();
    
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

export async function discoverRealDomain(
  saleorApiUrl: string, 
  token: string
): Promise<{ saleorApiUrl: string; domain: string } | null> {
  if (!isLocalhost(saleorApiUrl)) {
    return null; // 非localhost不需要发现
  }

  logger.info("检测到localhost URL，尝试获取真实域名信息");
  
  try {
    const client = createClient(saleorApiUrl, token);
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
          localhost: saleorApiUrl,
          realDomain: realDomainUrl,
          realApiUrl: realApiUrl,
        },
        "获取到真实域名，更新API URL"
      );
      
      try {
        const realDomainHost = new URL(realDomainUrl).hostname;
        return {
          saleorApiUrl: realApiUrl,
          domain: realDomainHost
        };
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
  
  return null;
}