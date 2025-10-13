import type { NextApiRequest, NextApiResponse } from "next";
import { createEpayClient, type EpayConfig } from "@/lib/epay/client";
import { env } from "@/lib/env.mjs";
import { createServerClient } from "@/lib/create-graphq-client";
import { createPrivateSettingsManager } from "@/modules/app-configuration/metadata-manager";
import { EpayConfigManager } from "@/modules/payment-app-configuration/epay-config-manager";
import { type EpayConfigEntry } from "@/modules/payment-app-configuration/epay-config";
import { siteManager } from "@/lib/managers/site-manager";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ component: "TransactionInitializeWebhook" });

// 定义事件数据接口
interface TransactionEvent {
  action: {
    amount: string;
    paymentMethodType?: string;
  };
  transaction: {
    id: string;
  };
  sourceObject?: {
    number?: string;
    lines?: Array<{
      productName?: string;
    }>;
  };
}

// 获取支付配置的函数
async function getEpayConfig(
  saleorApiUrl: string,
  token: string,
): Promise<{ config: EpayConfig | null; returnUrl: string | null }> {
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
        config: {
          pid: firstConfig.pid,
          key: firstConfig.key,
          apiUrl: firstConfig.apiUrl,
        },
        returnUrl: firstConfig.returnUrl || null,
      };
    }
  } catch (error) {
    console.error("从Saleor metadata获取支付配置失败:", error);
  }

  // 不再回退到环境变量配置
  console.warn("支付配置未找到，请在后台配置支付参数");
  return { config: null, returnUrl: null };
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
    const { event } = req.body as { event: TransactionEvent };
    const { action, transaction, sourceObject } = event;

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
    const { config: epayConfig, returnUrl } = await getEpayConfig(saleorApiUrl, authToken || "");
    if (!epayConfig) {
      return res.status(200).json({
        result: "CHARGE_FAILURE",
        message: "支付配置未找到，请在后台配置支付参数",
      });
    }

    const epayClient = createEpayClient(epayConfig);

    // 根据前端传入的支付类型或默认值
    // 支持任何自定义的支付方式
    const payType = action?.paymentMethodType || "alipay";

    // 创建订单号（包含交易ID以便回调时识别）
    const orderNo = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${
      transaction.id
    }`;

    // 获取商品名称（从订单信息中）
    const productName = sourceObject?.lines?.[0]?.productName || "订单支付";

    // 创建彩虹易支付订单
    const result = await epayClient.createOrder({
      amount: parseFloat(action.amount),
      orderNo,
      notifyUrl: `${env.APP_URL}/api/webhooks/epay-notify`,
      returnUrl: returnUrl || `${env.APP_URL}/checkout/success`, // 使用配置的返回地址或默认地址
      payType, // 直接使用传入的支付类型，支持自定义
      productName,
      productDesc: `订单号: ${sourceObject?.number || "未知"}`,
    });

    if (result.code === 1 && (result.payUrl || result.qrcode)) {
      // 返回支付链接或二维码
      return res.status(200).json({
        result: "CHARGE_ACTION_REQUIRED",
        amount: action.amount,
        data: {
          paymentUrl: result.payUrl,
          qrcode: result.qrcode,
          epayOrderNo: result.tradeNo,
          saleorOrderNo: orderNo,
          payType: result.type,
        },
      });
    }

    return res.status(200).json({
      result: "CHARGE_FAILURE",
      message: result.msg || "创建支付订单失败",
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : "未知错误",
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Transaction initialize error",
    );
    const message = error instanceof Error ? error.message : "未知错误";
    return res.status(200).json({
      result: "CHARGE_FAILURE",
      message,
    });
  }
}
