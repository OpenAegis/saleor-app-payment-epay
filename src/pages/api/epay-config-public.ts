import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";
import { createPrivateSettingsManager } from "../../modules/app-configuration/metadata-manager";
import { EpayConfigManager } from "../../modules/payment-app-configuration/epay-config-manager";
import { type EpayConfigEntry } from "../../modules/payment-app-configuration/epay-config";
import { createServerClient } from "@/lib/create-graphq-client";
import { createEpayClient } from "@/lib/epay/client";

const logger = createLogger({ component: "EpayConfigPublicAPI" });

/**
 * 公开的epay-config API - 用于诊断目的
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  logger.info("EpayConfigPublicAPI called with method: " + req.method);

  try {
    // 检查APL状态
    const aplConfigured = await saleorApp.apl.isConfigured();
    logger.info("APL配置状态: " + JSON.stringify(aplConfigured));

    if (!aplConfigured.configured) {
      return res.status(500).json({
        error: "APL not configured",
        details: aplConfigured.error?.message || "Unknown error",
      });
    }

    // 获取所有认证数据
    const allAuthData = await saleorApp.apl.getAll();
    logger.info(`找到 ${allAuthData.length} 条认证数据`);

    // 如果没有认证数据，返回空配置
    if (allAuthData.length === 0) {
      return res.status(200).json({
        message: "No auth data found",
        configurations: [],
        channelToConfigurationId: {},
      });
    }

    // 使用第一个认证数据进行测试
    const authData = allAuthData[0];
    const { saleorApiUrl, token } = authData;

    logger.info("Using auth data for: " + saleorApiUrl);

    if (!saleorApiUrl || !token) {
      logger.error("Missing saleorApiUrl or token in authData");
      return res.status(400).json({ error: "Missing authentication data" });
    }

    const client = createServerClient(saleorApiUrl, token);
    const settingsManager = createPrivateSettingsManager(client);
    const configManager = new EpayConfigManager(settingsManager, saleorApiUrl);

    switch (req.method) {
      case "GET":
        try {
          const config = await configManager.getConfig();
          logger.info("Config retrieved successfully");
          return res.status(200).json(config);
        } catch (error) {
          logger.error(
            "Error fetching epay config: " +
              (error instanceof Error ? error.message : "Unknown error"),
          );
          return res
            .status(500)
            .json({
              error: "Failed to fetch config",
              details: error instanceof Error ? error.message : "Unknown error",
            });
        }

      case "POST":
        // 简单测试
        return res.status(200).json({ success: true, message: "POST endpoint working" });

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    logger.error(
      "Unexpected error in epay-config-public API: " +
        (error instanceof Error ? error.message : "Unknown error"),
    );
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
