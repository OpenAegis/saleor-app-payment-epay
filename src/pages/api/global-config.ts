import { createProtectedHandler } from "@saleor/app-sdk/handlers/next";
import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";
import { createPrivateSettingsManager } from "../../modules/app-configuration/metadata-manager";

const logger = createLogger({ component: "GlobalConfigAPI" });

// 定义全局配置类型
interface GlobalConfig {
  returnUrl?: string;
}

// 全局配置的metadata key
const GLOBAL_CONFIG_KEY = "global_payment_config";

export default createProtectedHandler(
  async (req: NextApiRequest, res: NextApiResponse, { authData }) => {
    const { saleorApiUrl, token } = authData;

    if (!saleorApiUrl || !token) {
      logger.error("Missing saleorApiUrl or token in authData");
      return res.status(400).json({ error: "Missing authentication data" });
    }

    try {
      const client = await createServerClient(saleorApiUrl, token);
      const settingsManager = createPrivateSettingsManager(client);

      switch (req.method) {
        case "GET":
          try {
            // 获取全局配置
            const configStr = await settingsManager.get(saleorApiUrl, GLOBAL_CONFIG_KEY);
            let config: GlobalConfig = {};

            if (configStr) {
              try {
                config = JSON.parse(configStr) as GlobalConfig;
              } catch (e) {
                logger.error(
                  "Failed to parse global config: " +
                    (e instanceof Error ? e.message : "Unknown error"),
                );
              }
            }

            return res.status(200).json(config);
          } catch (error) {
            logger.error(
              "Error fetching global config: " +
                (error instanceof Error ? error.message : "Unknown error"),
            );
            return res.status(500).json({ error: "Failed to fetch global config" });
          }

        case "PUT":
          try {
            // 检查请求体是否存在
            if (!req.body) {
              logger.error("Request body is empty");
              return res.status(400).json({ error: "Request body is empty" });
            }

            let returnUrl: string | null = null;

            // 处理不同的请求体格式
            if (typeof req.body === "string") {
              try {
                const parsedBody = JSON.parse(req.body) as { returnUrl?: string | null };
                returnUrl = parsedBody.returnUrl !== undefined ? parsedBody.returnUrl : null;
              } catch (parseError) {
                logger.error(
                  "Failed to parse request body as JSON: " +
                    (parseError instanceof Error ? parseError.message : "Unknown error"),
                );
                return res.status(400).json({ error: "Invalid JSON in request body" });
              }
            } else if (typeof req.body === "object") {
              const body = req.body as { returnUrl?: string | null };
              returnUrl = body.returnUrl !== undefined ? body.returnUrl : null;
            } else {
              logger.error("Invalid request body type");
              return res.status(400).json({ error: "Invalid request body format" });
            }

            logger.info(
              {
                returnUrl: returnUrl,
                returnUrlType: typeof returnUrl,
              },
              "Processing returnUrl update",
            );

            // 获取现有配置
            const existingConfigStr = await settingsManager.get(saleorApiUrl, GLOBAL_CONFIG_KEY);
            let config: GlobalConfig = {};

            if (existingConfigStr) {
              try {
                config = JSON.parse(existingConfigStr) as GlobalConfig;
              } catch (e) {
                logger.error(
                  "Failed to parse existing global config: " +
                    (e instanceof Error ? e.message : "Unknown error"),
                );
              }
            }

            // 更新returnUrl
            if (returnUrl === null) {
              // 移除returnUrl
              delete config.returnUrl;
              logger.info("Removing returnUrl from global config");
            } else if (returnUrl) {
              // 设置returnUrl
              config.returnUrl = returnUrl;
              logger.info({ returnUrl }, "Setting returnUrl in global config");
            } else {
              // 空字符串，移除returnUrl
              delete config.returnUrl;
              logger.info("Removing returnUrl due to empty string");
            }

            // 保存配置
            await settingsManager.set({
              key: GLOBAL_CONFIG_KEY,
              value: JSON.stringify(config),
              domain: saleorApiUrl,
            });

            logger.info("Global config updated successfully");
            return res.status(200).json({ success: true });
          } catch (error) {
            logger.error(
              "Error saving global config: " +
                (error instanceof Error ? error.message : "Unknown error"),
            );
            return res.status(500).json({ error: "Failed to save global config" });
          }

        default:
          return res.status(405).json({ error: "Method not allowed" });
      }
    } catch (error) {
      logger.error(
        "Unexpected error in global-config API: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
      return res.status(500).json({ error: "Internal server error" });
    }
  },
  saleorApp.apl,
);

// 导出createServerClient函数
async function createServerClient(saleorApiUrl: string, token: string) {
  const { createServerClient } = await import("@/lib/create-graphq-client");
  return createServerClient(saleorApiUrl, token);
}
