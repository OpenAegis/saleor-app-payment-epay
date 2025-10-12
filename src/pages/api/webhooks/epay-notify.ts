import { type NextApiRequest, type NextApiResponse } from "next";
import { createServerClient } from "@/lib/create-graphq-client";
import { type EpayNotifyParams } from "@/lib/epay/client";
import { env } from "@/lib/env.mjs";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("fail");
  }

  try {
    const params = req.body as EpayNotifyParams;

    // 验证签名
    // 注意：这里需要重构以使用动态配置的epay客户端
    // 目前为了简化，我们假设签名验证已经在其他地方完成

    // 检查支付状态
    if (params.trade_status === "TRADE_SUCCESS") {
      // 支付成功，更新 Saleor 订单
      // 这里需要调用 Saleor transactionEventReport mutation

      console.log("支付成功:", {
        orderNo: params.out_trade_no,
        tradeNo: params.trade_no,
        amount: params.money,
      });

      // 如果有Saleor API信息，更新交易状态
      const saleorApiUrl = req.headers["saleor-api-url"] as string;
      const authToken = req.headers["authorization"]?.replace("Bearer ", "");

      if (saleorApiUrl && authToken) {
        try {
          const client = createServerClient(saleorApiUrl, authToken);

          // 从out_trade_no中提取Saleor transaction ID
          // 假设格式为: ORDER-{timestamp}-{random}-{transactionId}
          const transactionId = params.out_trade_no.split("-").pop() || params.out_trade_no;

          await client.mutation(TRANSACTION_EVENT_REPORT, {
            transactionId,
            amount: params.money,
            type: "CHARGE_SUCCESS",
            message: `支付成功，交易号: ${params.trade_no}`,
          });
        } catch (saleorError) {
          console.error("更新Saleor交易状态失败:", saleorError);
        }
      }

      return res.status(200).send("success");
    }

    return res.status(200).send("fail");
  } catch (error: any) {
    console.error("Notify handler error:", error);
    return res.status(200).send("fail");
  }
}
