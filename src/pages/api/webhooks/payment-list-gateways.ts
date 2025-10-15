import { type NextApiRequest, type NextApiResponse } from "next";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ component: "PaymentListGatewaysWebhook" });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info("Payment list gateways event received");

    // 返回支付网关信息
    const response = {
      data: [
        {
          id: "epay",
          name: "彩虹易支付",
          currencies: ["CNY"],
          config: [],
        },
      ],
      errors: [],
    };

    return res.status(200).json(response);
  } catch (error) {
    logger.error(
      `Payment list gateways handler error: ${error instanceof Error ? error.message : "未知错误"}`,
    );
    return res.status(500).json({
      data: [],
      errors: [{ message: "Internal server error" }],
    });
  }
}
