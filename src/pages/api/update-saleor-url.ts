import { createProtectedHandler } from "@saleor/app-sdk/handlers/next";
import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "UpdateSaleorUrlAPI" });

// 创建一个不使用认证的处理程序用于调试
export const config = {
  api: {
    externalResolver: true,
  },
};

export default createProtectedHandler(
  async (req: NextApiRequest, res: NextApiResponse, { authData }) => {
    logger.info("UpdateSaleorUrlAPI called with authData: " + JSON.stringify(authData));

    const { saleorApiUrl: currentSaleorApiUrl } = authData;

    switch (req.method) {
      case "GET":
        try {
          // 返回当前的Saleor API URL
          return res.status(200).json({
            saleorApiUrl: currentSaleorApiUrl || "",
            isPlaceholder:
              !currentSaleorApiUrl || currentSaleorApiUrl.includes("your-saleor-instance.com"),
          });
        } catch (error) {
          logger.error(
            "Error fetching Saleor URL: " + (error instanceof Error ? error.message : "未知错误"),
          );
          return res.status(500).json({ error: "Failed to fetch Saleor URL" });
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

          // 获取当前的authData
          const existingAuthData = await saleorApp.apl.get(currentSaleorApiUrl);

          if (!existingAuthData) {
            logger.warn("Auth data not found for URL: " + currentSaleorApiUrl);
            // 如果没有找到现有数据，创建新的authData
            const newAuthData = {
              saleorApiUrl: saleorApiUrl,
              domain: authData.domain || new URL(saleorApiUrl).hostname,
              token: authData.token,
              appId: authData.appId,
              jwks: authData.jwks,
            };

            // 保存新的authData
            await saleorApp.apl.set(newAuthData);

            logger.info("New Saleor API URL created successfully: " + saleorApiUrl);

            return res.status(200).json({
              success: true,
              message: "Saleor API URL created successfully",
              saleorApiUrl: saleorApiUrl,
            });
          }

          // 更新authData中的saleorApiUrl
          const updatedAuthData = {
            ...existingAuthData,
            saleorApiUrl: saleorApiUrl,
          };

          // 保存更新后的authData
          await saleorApp.apl.set(updatedAuthData);

          // 如果URL已更改，删除旧的记录
          if (currentSaleorApiUrl && currentSaleorApiUrl !== saleorApiUrl) {
            await saleorApp.apl.delete(currentSaleorApiUrl);
          }

          logger.info(
            "Saleor API URL updated successfully: " +
              JSON.stringify({
                oldUrl: currentSaleorApiUrl,
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
  },
  saleorApp.apl,
);