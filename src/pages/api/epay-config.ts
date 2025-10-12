import { createProtectedHandler } from "@saleor/app-sdk/handlers/next";
import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createPrivateSettingsManager } from "../../modules/app-configuration/metadata-manager";
import { EpayConfigManager } from "../../modules/payment-app-configuration/epay-config-manager";
import { type EpayConfigEntry } from "../../modules/payment-app-configuration/epay-config";
import { createServerClient } from "@/lib/create-graphq-client";
import { createEpayClient } from "@/lib/epay/client";

export default createProtectedHandler(
  async (req: NextApiRequest, res: NextApiResponse, { authData }) => {
    const { saleorApiUrl, token } = authData;
    const client = createServerClient(saleorApiUrl, token);
    const settingsManager = createPrivateSettingsManager(client);
    const configManager = new EpayConfigManager(settingsManager, saleorApiUrl);

    switch (req.method) {
      case "GET":
        try {
          // 获取所有配置或特定配置
          const configurationId = req.query.configurationId as string;
          if (configurationId) {
            const config = await configManager.getEpayConfigEntry(configurationId);
            return res.status(200).json(config || {});
          } else {
            const config = await configManager.getConfig();
            return res.status(200).json(config);
          }
        } catch (error) {
          console.error("Error fetching epay config:", error);
          return res.status(500).json({ error: "Failed to fetch config" });
        }

      case "POST":
        // 检查是否是测试请求
        if (req.query.test === "true") {
          try {
            const configData = req.body as EpayConfigEntry;
            const epayClient = createEpayClient({
              pid: configData.pid,
              key: configData.key,
              apiUrl: configData.apiUrl,
            });

            // 测试连接并获取商户信息
            const merchantInfo = await epayClient.queryMerchantInfo();

            if (merchantInfo.pid) {
              return res.status(200).json({
                success: true,
                message: `连接成功，商户: ${merchantInfo.name}`,
              });
            } else {
              return res.status(200).json({
                success: false,
                message: "连接失败，无法获取商户信息",
              });
            }
          } catch (error) {
            console.error("Error testing epay config:", error);
            return res.status(200).json({
              success: false,
              message: error instanceof Error ? error.message : "测试连接时发生错误",
            });
          }
        }

        // 保存配置
        try {
          const configData = req.body as EpayConfigEntry;
          await configManager.setEpayConfigEntry(configData);
          return res.status(200).json({ success: true });
        } catch (error) {
          console.error("Error saving epay config:", error);
          return res.status(500).json({ error: "Failed to save config" });
        }

      case "DELETE":
        try {
          const configurationId = req.query.configurationId as string;
          if (!configurationId) {
            return res.status(400).json({ error: "Configuration ID is required" });
          }
          await configManager.deleteEpayConfigEntry(configurationId);
          return res.status(200).json({ success: true });
        } catch (error) {
          console.error("Error deleting epay config:", error);
          return res.status(500).json({ error: "Failed to delete config" });
        }

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  },
  saleorApp.apl,
);
