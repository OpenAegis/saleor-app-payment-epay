import { type NextApiRequest, type NextApiResponse } from "next";
import { SALEOR_API_URL_HEADER } from "@saleor/app-sdk/const";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";
import { type ExtendedAuthData, TursoAPL } from "../../lib/turso-apl";
// import jwt from "jsonwebtoken";

const logger = createLogger({ component: "UpdateSaleorUrlAPI" });

// 创建一个不使用认证的处理程序用于调试
export const config = {
  api: {
    externalResolver: true,
  },
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  logger.info("UpdateSaleorUrlAPI called");
  logger.info("Request headers: " + JSON.stringify(req.headers));

  const authorizationHeader = req.headers["authorization-bearer"] as string;
  const requestedSaleorApiUrl = req.headers[SALEOR_API_URL_HEADER] as string;

  if (!authorizationHeader) {
    return res.status(401).json({ error: "Missing authorization-bearer header" });
  }

  if (!requestedSaleorApiUrl) {
    return res.status(400).json({ error: "Missing saleor-api-url header" });
  }

  // 简单解码JWT获取token（不验证签名，只提取payload）
  let tokenFromJWT: string;
  try {
    const parts = authorizationHeader.split('.');
    if (parts.length !== 3) {
      return res.status(401).json({ error: "Invalid JWT format" });
    }
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString()) as any;
    tokenFromJWT = payload?.token;
    
    if (!tokenFromJWT) {
      return res.status(401).json({ error: "Invalid JWT: missing token" });
    }
    logger.info(`Extracted token from JWT: ${tokenFromJWT}`);
  } catch (error) {
    logger.error("Failed to decode JWT: " + (error instanceof Error ? error.message : "Unknown"));
    return res.status(401).json({ error: "Invalid JWT format" });
  }

  // 通过token查找认证数据
  const tursoAPL = saleorApp.apl as TursoAPL;
  const existingAuthData = await tursoAPL.getByToken(tokenFromJWT);

  if (!existingAuthData) {
    logger.warn(`No auth data found for token: ${tokenFromJWT}`);
    return res.status(404).json({ 
      error: "No authentication data found",
      requestedUrl: requestedSaleorApiUrl
    });
  }

  logger.info(`Found auth data for token, current URL: ${existingAuthData.saleorApiUrl}`);

  switch (req.method) {
      case "GET":
        try {
          // 检查是否需要更新URL
          if (requestedSaleorApiUrl && existingAuthData.saleorApiUrl !== requestedSaleorApiUrl) {
            logger.info(`Auto-updating saleorApiUrl from ${existingAuthData.saleorApiUrl} to ${requestedSaleorApiUrl}`);
            
            // 更新认证数据中的URL
            const updatedAuthData: ExtendedAuthData = {
              ...existingAuthData,
              saleorApiUrl: requestedSaleorApiUrl,
            };
            
            // 保存新的认证数据
            await saleorApp.apl.set(updatedAuthData);
            
            // 删除旧的记录
            if (existingAuthData.saleorApiUrl !== requestedSaleorApiUrl) {
              await saleorApp.apl.delete(existingAuthData.saleorApiUrl);
            }
            
            logger.info("Saleor API URL automatically updated to: " + requestedSaleorApiUrl);
            
            return res.status(200).json({
              saleorApiUrl: requestedSaleorApiUrl,
              isPlaceholder: !requestedSaleorApiUrl || requestedSaleorApiUrl.includes("your-saleor-instance.com"),
              autoUpdated: true,
            });
          }
          
          // 如果URL没有变化，直接返回现有URL
          return res.status(200).json({
            saleorApiUrl: existingAuthData.saleorApiUrl,
            isPlaceholder: !existingAuthData.saleorApiUrl || existingAuthData.saleorApiUrl.includes("your-saleor-instance.com"),
            autoUpdated: false,
          });
        } catch (error) {
          logger.error(
            "Error updating Saleor URL: " + (error instanceof Error ? error.message : "未知错误"),
          );
          return res.status(500).json({ error: "Failed to update Saleor URL" });
        }

      case "POST":
        try {
          const { saleorApiUrl } = req.body as { saleorApiUrl: string };

          // 验证URL格式
          if (!saleorApiUrl) {
            logger.warn("No URL provided");
            return res.status(400).json({ error: "URL is required" });
          }

          try {
            new URL(saleorApiUrl);
          } catch (error) {
            logger.warn(
              "Invalid URL format provided: " +
                (error instanceof Error ? error.message : "未知错误"),
            );
            return res.status(400).json({ error: "Invalid URL format" });
          }

          // 更新认证数据中的URL
          const updatedAuthData: ExtendedAuthData = {
            ...existingAuthData,
            saleorApiUrl: saleorApiUrl,
          };

          // 保存更新后的authData
          await saleorApp.apl.set(updatedAuthData);

          // 删除旧的记录
          if (existingAuthData.saleorApiUrl !== saleorApiUrl) {
            await saleorApp.apl.delete(existingAuthData.saleorApiUrl);
          }

          logger.info(
            "Saleor API URL updated successfully: " +
              JSON.stringify({
                oldUrl: existingAuthData.saleorApiUrl,
                newUrl: saleorApiUrl,
              }),
          );

          return res.status(200).json({
            success: true,
            message: "Saleor API URL updated successfully",
            saleorApiUrl: saleorApiUrl,
          });
        } catch (error) {
          logger.error(
            "Error updating Saleor URL: " + (error instanceof Error ? error.message : "未知错误"),
          );
          return res.status(500).json({ error: "Failed to update Saleor URL" });
        }

      default:
        return res.status(405).json({ error: "Method not allowed" });
  }
}

export default handler;
