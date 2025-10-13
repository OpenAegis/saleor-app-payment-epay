import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";
import { createPrivateSettingsManager } from "../../modules/app-configuration/metadata-manager";
import { EpayConfigManager } from "../../modules/payment-app-configuration/epay-config-manager";
import { createServerClient } from "@/lib/create-graphq-client";

const logger = createLogger({ component: "DiagnoseEpayConfigAPI" });

/**
 * 诊断epay-config API - 检查epay-config逻辑
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  logger.info("DiagnoseEpayConfigAPI called");

  try {
    // 获取所有认证数据
    const allAuthData = await saleorApp.apl.getAll();
    logger.info(`Found ${allAuthData.length} auth records`);

    if (allAuthData.length === 0) {
      return res.status(404).json({ error: "No auth data found" });
    }

    // 使用第一条认证数据
    const authData = allAuthData[0];
    const { saleorApiUrl, token } = authData;

    logger.info("Using auth data for: " + saleorApiUrl);

    if (!saleorApiUrl || !token) {
      logger.error("Missing saleorApiUrl or token in authData");
      return res.status(400).json({ error: "Missing authentication data" });
    }

    // 尝试创建客户端
    try {
      const client = createServerClient(saleorApiUrl, token);
      logger.info("GraphQL client created successfully");

      const settingsManager = createPrivateSettingsManager(client);
      logger.info("Settings manager created successfully");

      const configManager = new EpayConfigManager(settingsManager, saleorApiUrl);
      logger.info("Config manager created successfully");

      // 尝试获取配置
      const config = await configManager.getConfig();
      logger.info("Config retrieved successfully");

      return res.status(200).json({
        success: true,
        message: "Epay config logic working",
        config,
        authData,
      });
    } catch (clientError) {
      logger.error(
        "创建客户端时出错: " +
          (clientError instanceof Error ? clientError.message : "Unknown error"),
      );
      return res.status(500).json({
        error: "Failed to create client",
        details: clientError instanceof Error ? clientError.message : "Unknown error",
        authData,
      });
    }
  } catch (error) {
    logger.error(
      "诊断epay-config时出错: " + (error instanceof Error ? error.message : "Unknown error"),
    );
    return res.status(500).json({
      error: "Diagnose failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
