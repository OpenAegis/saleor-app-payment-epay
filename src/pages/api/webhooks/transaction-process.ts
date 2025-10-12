import type { NextApiRequest, NextApiResponse } from "next";
import { createEpayClient, type EpayConfig } from "@/lib/epay/client";
import { createServerClient } from "@/lib/create-graphq-client";
import { createPrivateSettingsManager } from "@/modules/app-configuration/metadata-manager";
import { EpayConfigManager } from "@/modules/payment-app-configuration/epay-config-manager";
import { type EpayConfigEntry } from "@/modules/payment-app-configuration/epay-config";

// 定义事件数据接口
interface TransactionProcessEvent {
  action: {
    amount: string;
  };
  transaction: {
    id: string;
  };
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { event } = req.body as { event: TransactionProcessEvent };
    const { action, transaction } = event;

    // 获取支付配置
    const saleorApiUrl = req.headers["saleor-api-url"] as string;
    const authToken = req.headers["authorization"]?.replace("Bearer ", "");

    const epayConfig = await getEpayConfig(saleorApiUrl, authToken || "");
    if (!epayConfig) {
      return res.status(200).json({
        result: "CHARGE_FAILURE",
        message: "支付配置未找到，请在后台配置支付参数",
      });
    }

    const epayClient = createEpayClient(epayConfig);

    // 查询订单状态
    const result = await epayClient.queryOrder(transaction.id);

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
    console.error("Transaction process error:", error);
    const message = error instanceof Error ? error.message : "未知错误";
    return res.status(200).json({
      result: "CHARGE_FAILURE",
      message,
    });
  }
}
