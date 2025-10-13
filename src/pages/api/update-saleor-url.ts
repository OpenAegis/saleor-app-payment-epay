import { createProtectedHandler } from "@saleor/app-sdk/handlers/next";
import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "UpdateSaleorUrlAPI" });

export default createProtectedHandler(
  async (req: NextApiRequest, res: NextApiResponse, { authData }) => {
    const { saleorApiUrl: currentSaleorApiUrl } = authData;
    
    switch (req.method) {
      case "GET":
        try {
          // 返回当前的Saleor API URL
          return res.status(200).json({ 
            saleorApiUrl: currentSaleorApiUrl,
            isPlaceholder: currentSaleorApiUrl.includes("your-saleor-instance.com")
          });
        } catch (error) {
          logger.error("Error fetching Saleor URL: " + (error instanceof Error ? error.message : "未知错误"));
          return res.status(500).json({ error: "Failed to fetch Saleor URL" });
        }

      case "POST":
        try {
          const { saleorApiUrl } = req.body as { saleorApiUrl: string };
          
          // 验证URL格式
          try {
            new URL(saleorApiUrl);
          } catch (error) {
            logger.warn("Invalid URL format provided: " + (error instanceof Error ? error.message : "未知错误"));
            return res.status(400).json({ error: "Invalid URL format" });
          }
          
          // 获取当前的authData
          const existingAuthData = await saleorApp.apl.get(currentSaleorApiUrl);
          
          if (!existingAuthData) {
            return res.status(404).json({ error: "Auth data not found" });
          }
          
          // 更新authData中的saleorApiUrl
          const updatedAuthData = {
            ...existingAuthData,
            saleorApiUrl: saleorApiUrl
          };
          
          // 保存更新后的authData
          await saleorApp.apl.set(updatedAuthData);
          
          // 如果URL已更改，删除旧的记录
          if (currentSaleorApiUrl !== saleorApiUrl) {
            await saleorApp.apl.delete(currentSaleorApiUrl);
          }
          
          logger.info("Saleor API URL updated successfully: " + JSON.stringify({
            oldUrl: currentSaleorApiUrl,
            newUrl: saleorApiUrl
          }));
          
          return res.status(200).json({ 
            success: true, 
            message: "Saleor API URL updated successfully",
            saleorApiUrl: saleorApiUrl
          });
        } catch (error) {
          logger.error("Error updating Saleor URL: " + (error instanceof Error ? error.message : "未知错误"));
          return res.status(500).json({ error: "Failed to update Saleor URL" });
        }

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  },
  saleorApp.apl,
);