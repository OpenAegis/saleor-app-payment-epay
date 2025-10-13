import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "TestAPLAPI" });

/**
 * 测试 APL API - 测试认证持久化层是否正常工作
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (req.method === "GET") {
      // 测试读取
      logger.info("Testing APL read");
      
      // 检查APL配置
      const configured = await saleorApp.apl.isConfigured();
      logger.info("APL configured: " + JSON.stringify(configured));
      
      if (!configured.configured) {
        return res.status(500).json({ 
          error: "APL not configured",
          details: configured.error?.message || "Unknown error"
        });
      }
      
      // 获取所有数据
      const allData = await saleorApp.apl.getAll();
      logger.info(`Found ${allData.length} auth records`);
      
      return res.status(200).json({
        success: true,
        configured,
        count: allData.length,
        data: allData
      });
    } else {
      // 测试写入
      logger.info("Testing APL write");
      
      // 创建测试数据
      const testData = {
        saleorApiUrl: "https://test-instance.saleor.cloud/graphql/",
        domain: "test-instance.saleor.cloud",
        token: "test-token",
        appId: "test-app-id",
        jwks: "{}"
      };
      
      // 保存测试数据
      await saleorApp.apl.set(testData);
      logger.info("Test data saved");
      
      // 读取测试数据
      const retrievedData = await saleorApp.apl.get(testData.saleorApiUrl);
      logger.info("Retrieved test data: " + JSON.stringify(retrievedData));
      
      // 删除测试数据
      await saleorApp.apl.delete(testData.saleorApiUrl);
      logger.info("Test data deleted");
      
      return res.status(200).json({
        success: true,
        message: "APL test completed successfully",
        saved: testData,
        retrieved: retrievedData
      });
    }
  } catch (error) {
    logger.error("APL测试时出错: " + (error instanceof Error ? error.message : "Unknown error"));
    return res.status(500).json({ 
      error: "Failed to test APL",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}