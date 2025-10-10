import { authExchange } from "@urql/exchange-auth";
import { cacheExchange, createClient as urqlCreateClient, fetchExchange, Operation } from "@urql/core";
import { debugExchange } from "@urql/core";

interface IAuthState {
  token: string;
}

export const createClient = (url: string, token: string) =>
  urqlCreateClient({
    url,
    exchanges: [
      debugExchange,
      cacheExchange,
      fetchExchange,
    ],
    fetchOptions: {
      headers: {
        "Authorization-Bearer": token,
      },
    },
  });

export function createServerClient(saleorApiUrl: string, token: string) {
  return createClient(saleorApiUrl, token);
}

// 添加支持异步token获取的版本
export const createClientWithAsyncToken = (url: string, getToken: () => Promise<{ token: string }>) =>
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
              "Authorization-Bearer": token,
            });
          },
          didAuthError: () => false,
          willAuthError: () => false,
          refreshAuth: async () => {
            // Token refresh logic if needed
          },
        };
      }),
      fetchExchange,
    ],
  });