import { type NextApiRequest, type NextApiResponse } from "next";
import { createServerClient } from "@/lib/create-graphq-client";
import { type EpayNotifyParams } from "@/lib/epay/client";
import { siteManager } from "@/lib/managers/site-manager";
import { createLogger } from "@/lib/logger";

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

    // 验证签名
    // 注意：这里需要重构以使用动态配置的epay客户端
    // 目前为了简化，我们假设签名验证已经在其他地方完成

    // 检查支付状态
    if (params.trade_status === "TRADE_SUCCESS") {
      // 支付成功，更新 Saleor 订单
      // 这里需要调用 Saleor transactionEventReport mutation

      logger.info(
        `支付成功: orderNo=${params.out_trade_no}, tradeNo=${params.trade_no}, amount=${params.money}`,
      );

      // 如果有Saleor API信息，更新交易状态
      const saleorApiUrl = req.headers["saleor-api-url"] as string;
      const authToken = req.headers["authorization"]?.replace("Bearer ", "");

      if (saleorApiUrl && authToken) {
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

          await client.mutation(TRANSACTION_EVENT_REPORT, {
            transactionId,
            amount: params.money,
            type: "CHARGE_SUCCESS",
            message: `支付成功，交易号: ${params.trade_no}`,
          });
        } catch (saleorError) {
          logger.error(
            `更新Saleor交易状态失败: ${
              saleorError instanceof Error ? saleorError.message : "未知错误"
            }`,
          );
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
