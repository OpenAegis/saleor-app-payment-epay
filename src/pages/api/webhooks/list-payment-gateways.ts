import { type NextApiRequest, type NextApiResponse } from "next";
import { channelManager } from "../../../lib/managers/channel-manager";
import { type Channel } from "../../../lib/db/schema";
import { createLogger } from "../../../lib/logger";
import { env } from "../../../lib/env.mjs";

const logger = createLogger({ component: "ListPaymentGatewaysWebhook" });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  logger.info("List payment gateways webhook called");

  if (req.method !== "POST") {
    logger.warn("Method not allowed: %s", req.method || "undefined");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 获取所有启用的支付通道
    let enabledChannels: Channel[] = [];
    try {
      enabledChannels = await channelManager.getEnabled();
      logger.info(`Found ${enabledChannels.length} enabled channels`);
    } catch (dbError) {
      logger.error(
        "Database connection error: %s",
        dbError instanceof Error ? dbError.message : "Unknown error",
      );
      // 即使数据库连接失败，也返回空的支付方法列表而不是500错误
      enabledChannels = [];
    }

    // 将数据库中的支付通道转换为Saleor期望的格式
    // 每个通道都作为一个独立的支付方法返回
    const paymentGateways = enabledChannels.map((channel: Channel) => {
      // 构建图标URL配置
      const config = [];
      if (channel.icon) {
        const iconValue = channel.icon.toString();
        config.push({
          field: "iconUrl",
          value: iconValue.startsWith("http") ? iconValue : `${env.APP_URL}${iconValue}`,
        });
      }

      return {
        id: channel.id, // 使用通道ID作为支付方法ID
        name: channel.name, // 使用通道名称作为支付方法名称
        currencies: ["CNY"], // 默认使用CNY货币
        config: config, // 包含图标URL的配置信息
      };
    });

    // 根据Saleor规范，PAYMENT_LIST_GATEWAYS webhook应该直接返回支付网关列表
    // 每个支付网关对象应该包含id, name, currencies, config字段
    const response = paymentGateways;

    logger.info("Returning payment gateways: %s", JSON.stringify(response));

    logger.info(`Successfully returning ${paymentGateways.length} payment gateways`);
    return res.status(200).json(response);
  } catch (error) {
    logger.error(
      "Unexpected error in list payment gateways webhook: %s",
      error instanceof Error ? error.message : "Unknown error",
    );
    // 即使出现未预期的错误，也返回空的支付方法列表而不是500错误
    return res.status(200).json([]);
  }
}

// 禁用bodyParser，以便Saleor可以正确验证签名
export const config = {
  api: {
    bodyParser: false,
  },
};
