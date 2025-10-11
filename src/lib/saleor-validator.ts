import { createLogger } from "./logger";

const logger = createLogger({ component: "SaleorValidator" });

export interface SaleorValidationResult {
  isValid: boolean;
  version?: string;
  shopName?: string;
  error?: string;
}

/**
 * 验证给定的 URL 是否是真实的 Saleor 实例
 */
export class SaleorValidator {
  /**
   * 验证 Saleor URL 的有效性
   */
  async validateSaleorUrl(saleorApiUrl: string): Promise<SaleorValidationResult> {
    try {
      // 1. 检查 URL 格式
      const url = new URL(saleorApiUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        return {
          isValid: false,
          error: "无效的协议，只支持 HTTP 和 HTTPS",
        };
      }

      // 2. 尝试访问 GraphQL introspection 查询
      const introspectionQuery = `
        query {
          __schema {
            queryType {
              name
            }
            mutationType {
              name
            }
          }
        }
      `;

      const response = await fetch(saleorApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: introspectionQuery,
        }),
        // 设置较短的超时时间
        signal: AbortSignal.timeout(10000), // 10秒超时
      });

      if (!response.ok) {
        return {
          isValid: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json() as any;

      // 3. 检查响应是否包含 GraphQL schema
      if (!data.data?.__schema?.queryType?.name) {
        return {
          isValid: false,
          error: "响应不包含有效的 GraphQL schema",
        };
      }

      // 4. 尝试获取 Saleor 特定信息
      const saleorInfoQuery = `
        query {
          shop {
            name
            domain {
              host
            }
          }
        }
      `;

      const saleorResponse = await fetch(saleorApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: saleorInfoQuery,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (saleorResponse.ok) {
        const saleorData = await saleorResponse.json() as any;
        if (saleorData.data?.shop) {
          return {
            isValid: true,
            shopName: saleorData.data.shop.name,
          };
        }
      }

      // 5. 如果无法获取店铺信息，尝试检查是否有 Saleor 特定的类型
      const typeCheckQuery = `
        query {
          __type(name: "Shop") {
            name
            fields {
              name
            }
          }
        }
      `;

      const typeResponse = await fetch(saleorApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: typeCheckQuery,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (typeResponse.ok) {
        const typeData = await typeResponse.json() as any;
        if (typeData.data?.__type?.name === "Shop") {
          return {
            isValid: true,
          };
        }
      }

      return {
        isValid: false,
        error: "未检测到 Saleor GraphQL API",
      };
    } catch (error) {
      logger.error({ error, saleorApiUrl }, "Saleor URL 验证失败");
      
      if (error instanceof TypeError && error.message.includes("fetch")) {
        return {
          isValid: false,
          error: "网络连接失败，无法访问该 URL",
        };
      }
      
      if (error instanceof Error && error.name === "TimeoutError") {
        return {
          isValid: false,
          error: "请求超时，服务器响应太慢",
        };
      }

      return {
        isValid: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  }

  /**
   * 验证域名是否与 Saleor API URL 匹配
   */
  async validateDomainMatch(domain: string, saleorApiUrl: string): Promise<boolean> {
    try {
      const apiUrl = new URL(saleorApiUrl);
      const domainUrl = new URL(`https://${domain}`);
      
      // 检查域名是否匹配（忽略子域名差异）
      const apiHost = apiUrl.hostname.toLowerCase();
      const domainHost = domainUrl.hostname.toLowerCase();
      
      return apiHost === domainHost || 
             apiHost.endsWith(`.${domainHost}`) || 
             domainHost.endsWith(`.${apiHost}`);
    } catch (error) {
      logger.error({ error, domain, saleorApiUrl }, "域名匹配验证失败");
      return false;
    }
  }
}

export const saleorValidator = new SaleorValidator();