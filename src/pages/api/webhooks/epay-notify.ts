import { type NextApiRequest, type NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/create-graphq-client";
import { type EpayNotifyParams, type EpayConfig } from "@/lib/epay/client";
import { siteManager } from "@/lib/managers/site-manager";
import { createLogger } from "@/lib/logger";
import { db } from "@/lib/db/turso-client";
import { orderMappings } from "@/lib/db/schema";

const logger = createLogger({ component: "EpayNotifyWebhook" });

/**
 * 易支付回调接口
 *
 * 请求方式：GET
 * 回调 URL：{APP_URL}/api/webhooks/epay-notify
 *
 * v1 和 v2 的回调参数基本一致，主要字段：
 * - pid: 商户ID
 * - trade_no: 平台订单号
 * - out_trade_no: 商户订单号
 * - type: 支付方式
 * - trade_status: 交易状态（TRADE_SUCCESS 表示成功）
 * - money: 订单金额
 * - sign: 签名字符串
 * - sign_type: 签名类型（MD5 或 RSA）
 *
 * 响应要求：返回 "success" 表示接收成功
 */

// Saleor GraphQL mutations
const TRANSACTION_EVENT_REPORT = `
  mutation TransactionEventReport($id: ID!, $amount: PositiveDecimal!, $availableActions: [TransactionActionEnum!]!, $externalUrl: String, $message: String, $pspReference: String!, $time: DateTime!, $type: TransactionEventTypeEnum!) {
    transactionEventReport(
      id: $id
      amount: $amount
      availableActions: $availableActions
      externalUrl: $externalUrl
      message: $message
      pspReference: $pspReference
      time: $time
      type: $type
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
  // 易支付回调使用 GET 请求（v1 和 v2 都是）
  if (req.method !== "GET") {
    logger.warn({ method: req.method }, "收到非 GET 请求的回调");
    return res.status(405).send("fail");
  }

  try {
    // 易支付回调参数通过 query string 传递
    const params = req.query as unknown as EpayNotifyParams;
    logger.info(
      {
        tradeStatus: params.trade_status,
        orderNo: params.out_trade_no,
        tradeNo: params.trade_no,
        amount: params.money,
        pid: params.pid,
        signType: params.sign_type,
      },
      "收到易支付回调通知",
    );

    // 易支付回调不会携带 Saleor 认证信息，需要从数据库获取
    // 先通过订单号查找对应的 Saleor API 信息
    let saleorApiUrl: string | null = null;
    let transactionId: string | null = null;

    try {
      // 从订单映射表查找订单信息
      const mapping = await db
        .select()
        .from(orderMappings)
        .where(eq(orderMappings.orderNo, params.out_trade_no))
        .limit(1);

      if (mapping.length > 0) {
        saleorApiUrl = mapping[0].saleorApiUrl;
        transactionId = mapping[0].transactionId;
        logger.info(
          {
            orderNo: params.out_trade_no,
            transactionId,
            saleorApiUrl,
          },
          "从数据库查找到订单映射信息",
        );
      } else {
        logger.error(
          {
            orderNo: params.out_trade_no,
          },
          "未找到订单映射信息",
        );
        return res.status(400).send("fail");
      }
    } catch (dbError) {
      logger.error(
        {
          error: dbError instanceof Error ? dbError.message : "未知错误",
          orderNo: params.out_trade_no,
        },
        "查询订单映射失败",
      );
      return res.status(500).send("fail");
    }

    if (!saleorApiUrl || !transactionId) {
      logger.error("订单映射数据不完整");
      return res.status(400).send("fail");
    }

    // 从本地数据库获取支付配置以进行签名验证
    let epayConfig: EpayConfig | null = null;

    try {
      const { gatewayManager } = await import("@/lib/managers/gateway-manager");
      const enabledGateways = await gatewayManager.getEnabled();

      if (enabledGateways.length > 0) {
        // 找到匹配 pid 的网关配置
        const matchedGateway = enabledGateways.find((g) => g.epayPid === params.pid);
        const gateway = matchedGateway || enabledGateways[0];

        epayConfig = {
          pid: gateway.epayPid,
          key: gateway.epayKey,
          rsaPrivateKey: gateway.epayRsaPrivateKey || undefined,
          apiUrl: gateway.epayUrl,
          apiVersion: (gateway.apiVersion as "v1" | "v2") || "v1",
          signType: (gateway.signType as "MD5" | "RSA") || "MD5",
        };

        logger.info(
          {
            gatewayId: gateway.id,
            gatewayName: gateway.name,
            pid: gateway.epayPid,
            matchedByPid: !!matchedGateway,
          },
          "从本地数据库获取支付配置",
        );
      }
    } catch (configError) {
      logger.error(
        {
          error: configError instanceof Error ? configError.message : "未知错误",
        },
        "获取支付配置失败",
      );
    }

    if (!epayConfig) {
      logger.error("支付配置未找到，请在后台配置支付参数");
      return res.status(400).send("fail");
    }

    // 创建epay客户端以进行签名验证
    const { createEpayClient } = await import("@/lib/epay/client");
    const epayClient = createEpayClient(epayConfig);

    // 验证签名 - 从 query string 参数构建验证参数
    const paramsForVerify: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.query)) {
      // 排除 sign 和 sign_type
      if (key !== "sign" && key !== "sign_type" && value) {
        paramsForVerify[key] = String(value);
      }
    }

    // 添加签名用于验证
    const receivedSign = params.sign;
    paramsForVerify.sign = receivedSign;

    logger.info(
      {
        paramsKeys: Object.keys(paramsForVerify),
        signType: params.sign_type,
        receivedSignPreview: receivedSign.substring(0, 16) + "...",
      },
      "准备验证签名",
    );

    if (!epayClient.verifyNotify(paramsForVerify)) {
      logger.warn(
        {
          orderNo: params.out_trade_no,
          signType: params.sign_type,
          paramsKeys: Object.keys(paramsForVerify),
        },
        "签名验证失败",
      );
      return res.status(400).send("fail");
    }

    logger.info(
      {
        orderNo: params.out_trade_no,
        tradeNo: params.trade_no,
      },
      "签名验证成功",
    );
    // 检查支付状态
    if (params.trade_status === "TRADE_SUCCESS") {
      logger.info(
        {
          orderNo: params.out_trade_no,
          tradeNo: params.trade_no,
          amount: params.money,
          transactionId,
        },
        "支付成功，准备更新 Saleor 订单",
      );

      // 检查站点授权
      const isSiteAuthorized = await checkSiteAuthorization(saleorApiUrl);
      if (!isSiteAuthorized) {
        logger.warn({ saleorApiUrl }, "站点未授权访问支付功能");
        // 即使站点未授权，也返回 success 给易支付，避免重复回调
        return res.status(200).send("success");
      }

      // 更新订单状态为已支付
      try {
        await db
          .update(orderMappings)
          .set({
            status: "paid",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(orderMappings.orderNo, params.out_trade_no));

        logger.info(
          {
            orderNo: params.out_trade_no,
          },
          "更新订单状态为已支付",
        );
      } catch (updateError) {
        logger.error(
          {
            error: updateError instanceof Error ? updateError.message : "未知错误",
            orderNo: params.out_trade_no,
          },
          "更新订单状态失败",
        );
      }

      // 调用 Saleor API 报告交易成功
      // 注意：易支付回调不会携带认证 token，需要使用应用的权限
      try {
        // 从数据库获取应用 token（用于服务端调用）
        const { saleorApp } = await import("@/saleor-app");

        // 添加调试信息
        logger.info(
          {
            saleorApiUrl,
            transactionId,
            orderNo: params.out_trade_no,
          },
          "准备从数据库获取认证数据",
        );

        const authData = await saleorApp.apl.get(saleorApiUrl);
        const appToken = authData?.token;

        // 添加更多调试信息
        logger.info(
          {
            hasAuthData: !!authData,
            hasToken: !!appToken,
            tokenPreview: appToken ? appToken.substring(0, 10) + "..." : "null",
            saleorApiUrl,
          },
          "认证数据获取结果",
        );

        if (!appToken) {
          logger.error(
            {
              saleorApiUrl,
              authDataKeys: authData ? Object.keys(authData) : "null",
            },
            "缺少 SALEOR_APP_TOKEN，无法调用 Saleor API",
          );
          // 即使缺少token，也要返回 success 给易支付，避免重复回调
          return res.status(200).send("success");
        }

        // 在调用Saleor API之前，先手动刷新一次token
        console.log("[DEBUG] Manually refreshing token before Saleor API call");
        const freshAuthData = await saleorApp.apl.get(saleorApiUrl);
        const freshToken = freshAuthData?.token;

        if (!freshToken) {
          logger.error(
            {
              saleorApiUrl,
              authDataKeys: freshAuthData ? Object.keys(freshAuthData) : "null",
            },
            "无法获取新鲜的 SALEOR_APP_TOKEN，无法调用 Saleor API",
          );
          // 即使缺少token，也要返回 success 给易支付，避免重复回调
          return res.status(200).send("success");
        }

        console.log("[DEBUG] Got fresh token, length: " + freshToken.length);
        // 记录token的部分信息用于调试（不记录完整token）
        console.log("[DEBUG] Fresh token preview: " + freshToken.substring(0, 20) + "...");

        // 使用Saleor App SDK推荐的方式创建客户端
        const client = createClient(saleorApiUrl, saleorApiUrl);

        // 记录调用Saleor API前的信息
        logger.info(
          {
            transactionId,
            orderNo: params.out_trade_no,
            tradeNo: params.trade_no,
            amount: params.money,
            saleorApiUrl,
            // 记录token的部分信息用于调试（不记录完整token）
            tokenPreview: appToken.substring(0, 10) + "...",
          },
          "准备调用 Saleor API 更新交易状态",
        );

        const result = await client.mutation(TRANSACTION_EVENT_REPORT, {
          id: transactionId, // 修复：参数名应该是id而不是transactionId
          amount: params.money,
          availableActions: [], // 添加必需的availableActions参数
          externalUrl: "", // 添加必需的externalUrl参数
          message: `支付成功，易支付交易号: ${params.trade_no}`,
          pspReference: params.trade_no, // 使用易支付的交易号作为pspReference
          time: new Date().toISOString(), // 添加必需的time参数
          type: "CHARGE_SUCCESS",
        });

        // 检查Saleor API调用结果
        if (result.error) {
          logger.error(
            {
              error: JSON.stringify(result.error),
              transactionId,
              orderNo: params.out_trade_no,
              tradeNo: params.trade_no,
              saleorApiUrl,
            },
            "Saleor API 调用错误",
          );
          // Saleor API调用失败，仍然返回 success 给易支付，避免重复回调
          // 但记录错误以便后续处理
        } else {
          logger.info(
            {
              transactionId,
              orderNo: params.out_trade_no,
              tradeNo: params.trade_no,
            },
            "成功更新 Saleor 交易状态",
          );
        }
      } catch (saleorError) {
        logger.error(
          {
            error: saleorError instanceof Error ? saleorError.message : "未知错误",
            stack: saleorError instanceof Error ? saleorError.stack : undefined,
            transactionId,
          },
          "更新 Saleor 交易状态失败",
        );
        // 即使出现异常，也返回 success 给易支付，避免重复回调
      }

      // 只有在处理完所有逻辑后才返回 success 给易支付
      logger.info(
        {
          transactionId,
          orderNo: params.out_trade_no,
          tradeNo: params.trade_no,
        },
        "处理完毕，返回 success 给易支付",
      );
      return res.status(200).send("success");
    }

    logger.warn(
      {
        tradeStatus: params.trade_status,
        orderNo: params.out_trade_no,
      },
      "Notify received non-success trade status",
    );

    // 失败时返回5xx状态码
    return res.status(500).send("fail");
  } catch (error) {
    logger.error(`Notify handler error: ${error instanceof Error ? error.message : "未知错误"}`);
    // 发生未处理的错误时，返回5xx状态码
    return res.status(500).send("fail");
  }
}
