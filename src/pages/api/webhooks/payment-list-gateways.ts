import { type NextApiRequest, type NextApiResponse } from "next";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ component: "PaymentGatewayInitializeWebhook" });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info("Payment gateway initialize event received");

    // 根据Saleor文档，PAYMENT_GATEWAY_INITIALIZE_SESSION webhook应该返回一个包含data字段的对象
    // 这个data字段会被直接返回给storefront
    const response = {
      data: {
        // 返回支付方法列表，符合Saleor新API的要求
        paymentMethods: [
          {
            id: "epay",
            name: "彩虹易支付",
            currencies: ["CNY"],
            config: [],
          },
        ],
        // 可以添加其他需要的配置信息
        clientKey: "epay-client-key",
        environment: "LIVE",
      },
    };

    logger.info("Sending payment gateway response");
    return res.status(200).json(response);
  } catch (error) {
    logger.error(
      `Payment gateway initialize handler error: ${
        error instanceof Error ? error.message : "未知错误"
      }`,
    );
    return res.status(500).json({
      data: {
        paymentMethods: [],
        clientKey: null,
        environment: null,
      },
    });
  }
}
