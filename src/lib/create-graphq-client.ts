import { authExchange } from "@urql/exchange-auth";
import {
  cacheExchange,
  createClient as urqlCreateClient,
  fetchExchange,
  debugExchange,
  type Operation,
  type CombinedError,
} from "@urql/core";
import { saleorApp } from "@/saleor-app";

// 创建一个缓存来存储最新的token
// let cachedToken: string | null = null;
let tokenFetchPromise: Promise<string> | null = null;

// 从APL获取最新token的函数
async function fetchLatestToken(saleorApiUrl: string): Promise<string> {
  // 如果已经有正在获取token的promise，直接返回它
  if (tokenFetchPromise) {
    return tokenFetchPromise;
  }

  // 创建新的获取token的promise
  tokenFetchPromise = (async () => {
    try {
      const authData = await saleorApp.apl.get(saleorApiUrl);
      const token = authData?.token;

      if (!token) {
        throw new Error("无法获取认证token");
      }

      // cachedToken = token;
      return token;
    } finally {
      // 清除promise引用
      tokenFetchPromise = null;
    }
  })();

  return tokenFetchPromise;
}

export const createClient = (url: string, saleorApiUrl: string) =>
  urqlCreateClient({
    url,
    exchanges: [
      debugExchange,
      cacheExchange,
      authExchange(async (utils) => {
        // 获取初始token
        const token = await fetchLatestToken(saleorApiUrl);

        return {
          addAuthToOperation: (operation: Operation) => {
            return utils.appendHeaders(operation, {
              Authorization: `Bearer ${token}`,
            });
          },
          didAuthError: (error: CombinedError) => {
            // 检查是否是token过期错误
            return error.graphQLErrors.some((e) => {
              const exception = e.extensions?.exception as { code?: string } | undefined;
              return exception?.code === "ExpiredSignatureError";
            });
          },
          willAuthError: () => false,
          refreshAuth: async () => {
            // Token过期时刷新token
            try {
              await fetchLatestToken(saleorApiUrl);
            } catch (error) {
              console.error("刷新token失败:", error);
            }
          },
        };
      }),
      fetchExchange,
    ],
  });

export function createServerClient(saleorApiUrl: string, token: string) {
  // 对于服务器端调用，我们直接使用token
  return urqlCreateClient({
    url: saleorApiUrl,
    exchanges: [debugExchange, cacheExchange, fetchExchange],
    fetchOptions: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

// 添加支持异步token获取的版本
export const createClientWithAsyncToken = (
  url: string,
  getToken: () => Promise<{ token: string }>,
) =>
  urqlCreateClient({
    url,
    exchanges: [
      debugExchange,
      cacheExchange,
      authExchange(async (utils) => {
        const { token } = await getToken();
        return {
          addAuthToOperation: (operation: Operation) => {
            return utils.appendHeaders(operation, {
              Authorization: `Bearer ${token}`,
            });
          },
          didAuthError: (error: CombinedError) => {
            // 检查是否是token过期错误
            return error.graphQLErrors.some((e) => {
              const exception = e.extensions?.exception as { code?: string } | undefined;
              return exception?.code === "ExpiredSignatureError";
            });
          },
          willAuthError: () => false,
          refreshAuth: async () => {
            // Token过期时刷新token
            try {
              await getToken();
            } catch (error) {
              console.error("刷新token失败:", error);
            }
          },
        };
      }),
      fetchExchange,
    ],
  });
