import { type NextApiRequest, type NextApiResponse } from "next";
import { createServerClient } from "@/lib/create-graphq-client";
import { type EpayNotifyParams, type EpayConfig } from "@/lib/epay/client";
import { siteManager } from "@/lib/managers/site-manager";
import { createLogger } from "@/lib/logger";
import { createPrivateSettingsManager } from "@/modules/app-configuration/metadata-manager";
import { EpayConfigManager } from "@/modules/payment-app-configuration/epay-config-manager";
import { type EpayConfigEntry } from "@/modules/payment-app-configuration/epay-config";

const logger = createLogger({ component: "EpayNotifyWebhook" });

// Saleor GraphQL mutations
const TRANSACTION_EVENT_REPORT = `
  mutation TransactionEventReport($transactionId: ID!, $amount: PositiveDecimal!, $type: TransactionEventTypeEnum!, $message: String) {
    transactionEventReport(
      transactionId: $transactionId
      amount: $amount
      type: $type
      message: $message
    ) {
      errors {
        field
        message
        code
      }
    }
  }
`;

// 获取支付配置的函数
async function getEpayConfig(saleorApiUrl: string, token: string): Promise<EpayConfig | null> {
  try {
    // 从Saleor的metadata中获取配置
    const client = createServerClient(saleorApiUrl, token);
    const settingsManager = createPrivateSettingsManager(client);
    const configManager = new EpayConfigManager(settingsManager, saleorApiUrl);

    // 获取配置（这里简化处理，实际应该根据channel等信息获取对应配置）
    const config = await configManager.getConfig();

    // 获取第一个配置项作为默认配置
    if (config.configurations && config.configurations.length > 0) {
      const firstConfig = config.configurations[0] as EpayConfigEntry;
      return {
        pid: firstConfig.pid,
        key: firstConfig.key,
        apiUrl: firstConfig.apiUrl,
      };
    }
  } catch (error) {
    console.error("从Saleor metadata获取支付配置失败:", error);
  }

  // 不再回退到环境变量配置
  console.warn("支付配置未找到，请在后台配置支付参数");
  return null;
}

// 检查站点授权
async function checkSiteAuthorization(saleorApiUrl: string): Promise<boolean> {
  try {
    // 从URL中提取域名
    const url = new URL(saleorApiUrl);
    const domain = url.hostname;

    logger.info({ domain, saleorApiUrl }, "检查站点授权");

    // 检查站点是否已授权
    const isAuthorized = await siteManager.isAuthorized(domain);

    if (!isAuthorized) {
      logger.warn({ domain, saleorApiUrl }, "站点未授权访问支付功能");
      return false;
    }

    logger.info({ domain, saleorApiUrl }, "站点授权检查通过");
    return true;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : "未知错误",
        saleorApiUrl,
      },
      "站点授权检查失败",
    );
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("fail");
  }

  try {
    const params = req.body as EpayNotifyParams;

    // 获取Saleor API信息
    const saleorApiUrl = req.headers["saleor-api-url"] as string;
    const authToken = req.headers["authorization"]?.replace("Bearer ", "");

    // 验证必要参数
    if (!saleorApiUrl || !authToken) {
      logger.warn("缺少必要的Saleor API信息");
      return res.status(400).send("fail");
    }

    // 获取支付配置以进行签名验证
    const epayConfig = await getEpayConfig(saleorApiUrl, authToken);
    if (!epayConfig) {
      logger.error("支付配置未找到，请在后台配置支付参数");
      return res.status(400).send("fail");
    }

    // 创建epay客户端以进行签名验证
    const { createEpayClient } = await import("@/lib/epay/client");
    const epayClient = createEpayClient(epayConfig);

    // 验证签名
    const paramsForVerify: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.body as Record<string, unknown>)) {
      if (key !== "sign" && key !== "sign_type") {
        paramsForVerify[key] = String(value);
      }
    }

    if (!epayClient.verifyNotify(paramsForVerify)) {
      logger.warn("签名验证失败");
      return res.status(400).send("fail");
    }

    // 检查支付状态
    if (params.trade_status === "TRADE_SUCCESS") {
      // 支付成功，更新 Saleor 订单
      // 这里需要调用 Saleor transactionEventReport mutation

      logger.info(
        `支付成功: orderNo=${params.out_trade_no}, tradeNo=${params.trade_no}, amount=${params.money}`,
      );

      // Saleor API信息已在前面获取

      if (saleorApiUrl && authToken) {
        // 检查是否已经处理过此订单（防重复处理）
        // 注意：在生产环境中，应该使用数据库来存储已处理的订单号
        // 这里简化处理，仅记录日志
        logger.info(`准备处理订单: ${params.out_trade_no}`);
        // 检查站点授权
        const isSiteAuthorized = await checkSiteAuthorization(saleorApiUrl);
        if (!isSiteAuthorized) {
          logger.warn("站点未授权访问支付功能");
          return res.status(403).send("fail");
        }

        try {
          const client = createServerClient(saleorApiUrl, authToken);

          // 从out_trade_no中提取Saleor transaction ID
          // 假设格式为: ORDER-{timestamp}-{random}-{transactionId}
          const transactionId = params.out_trade_no.split("-").pop() || params.out_trade_no;

          const result = await client.mutation(TRANSACTION_EVENT_REPORT, {
            transactionId,
            amount: params.money,
            type: "CHARGE_SUCCESS",
            message: `支付成功，交易号: ${params.trade_no}`,
          });

          // 检查Saleor API调用结果
          if (result.error) {
            logger.error(`Saleor API调用错误: ${JSON.stringify(result.error)}`);
            // 根据业务需求决定是否返回失败
          } else {
            logger.info(`成功更新Saleor交易状态: ${transactionId}`);
          }
        } catch (saleorError) {
          logger.error(
            `更新Saleor交易状态失败: ${
              saleorError instanceof Error ? saleorError.message : "未知错误"
            }`,
          );

          // 记录错误堆栈（如果需要调试）
          if (saleorError instanceof Error && saleorError.stack) {
            logger.debug(saleorError.stack);
          }
          // 不返回错误给支付网关，因为这已经是异步处理
          // 支付网关只关心是否收到"success"响应
        }
      }

      return res.status(200).send("success");
    }

    return res.status(200).send("fail");
  } catch (error) {
    logger.error(`Notify handler error: ${error instanceof Error ? error.message : "未知错误"}`);
    return res.status(200).send("fail");
  }
}
