import { type NextApiRequest, type NextApiResponse } from "next";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ component: "PaymentGatewayInitializeWebhook" });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info("Payment gateway initialize event received");

    // 返回支付网关信息
    const response = {
      data: {
        paymentMethodsResponse: {
          id: "epay",
          name: "彩虹易支付",
          currencies: ["CNY"],
          config: [],
        },
        clientKey: "epay-client-key",
        environment: "LIVE",
      },
      errors: [],
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
        paymentMethodsResponse: null,
        clientKey: null,
        environment: null,
      },
      errors: [{ message: "Internal server error" }],
    });
  }
}