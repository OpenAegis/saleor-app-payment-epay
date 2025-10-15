import { type NextApiRequest, type NextApiResponse } from "next";
import { channelManager } from "../../../lib/managers/channel-manager";
import { type Channel } from "../../../lib/db/schema";
import { createLogger } from "../../../lib/logger";

const logger = createLogger({ component: "PaymentGatewayWebhook" });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  logger.info("Payment gateway initialize webhook called");

  if (req.method !== "POST") {
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
        "Database connection error: " +
          (dbError instanceof Error ? dbError.message : "Unknown error"),
      );
      // 即使数据库连接失败，也返回空的支付方法列表而不是500错误
      // 这样Saleor不会认为webhook失败，而是认为没有可用的支付方法
      enabledChannels = [];
    }

    // 将数据库中的支付通道转换为Saleor期望的格式
    // 每个通道都作为一个独立的支付方法返回
    const paymentMethods = enabledChannels.map((channel: Channel) => ({
      id: channel.id, // 使用通道ID作为支付方法ID
      name: channel.name, // 使用通道名称作为支付方法名称
      currencies: ["CNY"], // 默认使用CNY货币
      config: [], // Saleor应用不直接暴露配置信息
    }));

    // 根据GitHub Issue #12016，PAYMENT_GATEWAY_INITIALIZE_SESSION webhook应该返回一个包含data字段的对象
    // data字段应该包含实际的响应数据
    const responseData = {
      paymentMethodsResponse: {
        paymentMethods,
      },
      clientKey: "epay-client-key",
      environment: "LIVE",
    };

    const response = {
      data: responseData,
    };

    logger.info(`Successfully returning ${paymentMethods.length} payment methods`);
    return res.status(200).json(response);
  } catch (error) {
    logger.error(
      "Unexpected error in payment gateway webhook: " +
        (error instanceof Error ? error.message : "Unknown error"),
    );
    // 即使出现未预期的错误，也返回空的支付方法列表而不是500错误
    const response = {
      data: {
        paymentMethodsResponse: {
          paymentMethods: [],
        },
        clientKey: "epay-client-key",
        environment: "LIVE",
      },
    };
    return res.status(200).json(response);
  }
}

// 禁用bodyParser，以便Saleor可以正确验证签名
export const config = {
  api: {
    bodyParser: false,
  },
};
