import { createProtectedHandler } from "@saleor/app-sdk/handlers/next";
import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";
import { GLOBAL_CONFIG_KEY, parseGlobalConfig } from "../../lib/global-config";
import { createPrivateSettingsManager } from "../../modules/app-configuration/metadata-manager";

const logger = createLogger({ component: "GlobalConfigAPI" });

interface GlobalConfigUpdateBody {
  returnUrl?: string | null;
}

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
            const config = parseGlobalConfig(configStr);

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

            const body = parseRequestBody(req.body);
            const hasReturnUrl = Object.prototype.hasOwnProperty.call(body, "returnUrl");

            if (!hasReturnUrl) {
              return res.status(400).json({ error: "No supported config fields provided" });
            }

            const returnUrl = body.returnUrl !== undefined ? body.returnUrl : null;

            logger.info(
              {
                returnUrl: returnUrl,
                returnUrlType: typeof returnUrl,
              },
              "Processing returnUrl update",
            );

            // 获取现有配置
            const existingConfigStr = await settingsManager.get(saleorApiUrl, GLOBAL_CONFIG_KEY);
            const config = parseGlobalConfig(existingConfigStr);

            // 更新returnUrl
            if (hasReturnUrl) {
              if (returnUrl === null) {
                delete config.returnUrl;
                logger.info("Removing returnUrl from global config");
              } else if (returnUrl) {
                config.returnUrl = returnUrl;
                logger.info({ returnUrl }, "Setting returnUrl in global config");
              } else {
                delete config.returnUrl;
                logger.info("Removing returnUrl due to empty string");
              }
            }

            // 保存配置
            await settingsManager.set({
              key: GLOBAL_CONFIG_KEY,
              value: JSON.stringify(config),
              domain: saleorApiUrl,
            });

            logger.info("Global config updated successfully");
            return res.status(200).json({
              success: true,
              config,
            });
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

function parseRequestBody(body: NextApiRequest["body"]): GlobalConfigUpdateBody {
  if (typeof body === "string") {
    return JSON.parse(body) as GlobalConfigUpdateBody;
  }

  if (typeof body === "object" && body !== null) {
    return body as GlobalConfigUpdateBody;
  }

  throw new Error("Invalid request body format");
}
