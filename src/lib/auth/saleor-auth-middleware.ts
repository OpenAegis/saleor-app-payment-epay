import { type NextApiRequest, type NextApiResponse } from "next";
import { SALEOR_AUTHORIZATION_BEARER_HEADER, SALEOR_API_URL_HEADER } from "@saleor/app-sdk/const";
import { type AuthData } from "@saleor/app-sdk/APL";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../logger";

const logger = createLogger({ component: "SaleorAuthMiddleware" });

export interface AuthenticatedRequest extends NextApiRequest {
  authData: AuthData;
}

export type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: NextApiResponse,
) => Promise<void> | void;

/**
 * 自定义的Saleor认证中间件，处理authorization-bearer头
 */
export function withSaleorAuth(handler: AuthenticatedHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // 从请求头获取认证信息
      const token = req.headers[SALEOR_AUTHORIZATION_BEARER_HEADER] as string;
      const saleorApiUrl = req.headers[SALEOR_API_URL_HEADER] as string;

      logger.info("Auth middleware - token exists: " + !!token);
      logger.info("Auth middleware - saleorApiUrl: " + saleorApiUrl);

      if (!token || !saleorApiUrl) {
        logger.warn("Missing authentication headers");
        return res.status(401).json({ error: "Missing authentication headers" });
      }

      // 从APL获取认证数据
      let authData = await saleorApp.apl.get(saleorApiUrl);

      if (!authData) {
        logger.warn("No auth data found for: " + saleorApiUrl);
        
        // 对于update-saleor-url API，尝试使用占位符URL的认证数据
        const isUpdateUrlEndpoint = req.url?.includes('/update-saleor-url');
        if (isUpdateUrlEndpoint) {
          logger.info("Trying fallback for update-saleor-url endpoint");
          const allAuthData = await saleorApp.apl.getAll();
          
          // 查找占位符URL或者token匹配的认证数据
          const fallbackData = allAuthData.find(data => 
            data.saleorApiUrl.includes('your-saleor-instance.com') || 
            data.token === token
          );
          
          if (fallbackData) {
            logger.info("Found fallback auth data with URL: " + fallbackData.saleorApiUrl);
            authData = fallbackData;
          }
        }
        
        if (!authData) {
          // 调试: 显示所有可用的认证数据
          const allAuthData = await saleorApp.apl.getAll();
          logger.info("Available auth data URLs: " + JSON.stringify(allAuthData.map(d => d.saleorApiUrl)));
          
          return res.status(401).json({ 
            error: "No authentication data found",
            requestedUrl: saleorApiUrl,
            availableUrls: allAuthData.map(d => d.saleorApiUrl)
          });
        }
      }

      // 验证token (简单比较，实际应该验证JWT)
      if (authData.token !== token) {
        logger.warn("Token mismatch");
        return res.status(401).json({ error: "Invalid token" });
      }

      logger.info("Authentication successful for: " + saleorApiUrl);

      // 将认证数据添加到请求对象
      (req as AuthenticatedRequest).authData = authData;

      // 调用实际的处理函数
      return await handler(req as AuthenticatedRequest, res);
    } catch (error) {
      logger.error("Authentication error: " + (error instanceof Error ? error.message : "Unknown error"));
      return res.status(500).json({ error: "Authentication failed" });
    }
  };
}