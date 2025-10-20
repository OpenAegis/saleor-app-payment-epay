import type { NextApiRequest, NextApiResponse } from "next";
import { createEpayClient, type EpayConfig } from "@/lib/epay/client";
import { createServerClient } from "@/lib/create-graphq-client";
import { createPrivateSettingsManager } from "@/modules/app-configuration/metadata-manager";
import { EpayConfigManager } from "@/modules/payment-app-configuration/epay-config-manager";
import { type EpayConfigEntry } from "@/modules/payment-app-configuration/epay-config";
import { siteManager } from "@/lib/managers/site-manager";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ component: "TransactionProcessWebhook" });

// 定义事件数据接口
interface TransactionProcessEvent {
  action: {
    amount: string;
  };
  transaction: {
    id: string;
  };
  // Carry-over data from initialize step. We expect provider reference here.
  data?: Record<string, any>;
}

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
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info({
      path: "/api/webhooks/transaction-process",
      method: req.method,
      saleorApiUrl: req.headers["saleor-api-url"],
      userAgent: req.headers["user-agent"],
    }, "Process webhook called");
    const { event } = req.body as { event: TransactionProcessEvent };
    const { action, transaction, data } = event;

    // 获取Saleor API信息
    const saleorApiUrl = req.headers["saleor-api-url"] as string;
    const authToken = req.headers["authorization"]?.replace("Bearer ", "");

    // 验证必要参数
    if (!saleorApiUrl || !authToken) {
      logger.warn("缺少必要的Saleor API信息");
      return res.status(400).json({
        result: "CHARGE_FAILURE",
        message: "缺少必要的Saleor API信息",
      });
    }

    // 检查站点授权
    const isSiteAuthorized = await checkSiteAuthorization(saleorApiUrl);
    if (!isSiteAuthorized) {
      return res.status(403).json({
        result: "CHARGE_FAILURE",
        message: "站点未授权使用支付功能",
      });
    }

    // 获取支付配置
    const epayConfig = await getEpayConfig(saleorApiUrl, authToken || "");
    if (!epayConfig) {
      return res.status(200).json({
        result: "CHARGE_FAILURE",
        message: "支付配置未找到，请在后台配置支付参数",
      });
    }

    const epayClient = createEpayClient(epayConfig);

    // Prefer provider order id from initialize data; fallback to transaction.id
    const providerRef = (data && (data["epayOrderNo"] || data["pspReference"] || data["externalId"])) || transaction.id;

    // 查询时按 trade_no 查询；如你使用 out_trade_no，可将 useOutTradeNo 设为 true
    const result = await epayClient.queryOrder(providerRef, false);

    if (result.status === 1 && result.trade_status === "TRADE_SUCCESS") {
      return res.status(200).json({
        result: "CHARGE_SUCCESS",
        amount: action.amount,
        data: {
          epayTradeNo: result.trade_no,
        },
      });
    } else if (result.status === 0 || result.trade_status === "TRADE_CLOSED") {
      return res.status(200).json({
        result: "CHARGE_FAILURE",
        message: "支付失败或已关闭",
      });
    } else {
      return res.status(200).json({
        result: "CHARGE_PENDING",
        message: "支付处理中",
      });
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : "未知错误",
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Transaction process error",
    );
    const message = error instanceof Error ? error.message : "未知错误";
    return res.status(200).json({
      result: "CHARGE_FAILURE",
      message,
    });
  }
}
