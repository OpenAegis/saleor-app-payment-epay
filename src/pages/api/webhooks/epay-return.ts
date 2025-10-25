import { type NextApiRequest, type NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { db } from "@/lib/db/turso-client";
import { orderMappings, type OrderMapping } from "@/lib/db/schema";

const logger = createLogger({ component: "EpayReturnWebhook" });

// 定义支付响应数据接口
interface PaymentResponse {
  returnUrl?: string;
  [key: string]: unknown; // 允许其他属性
}

/**
 * 替换URL中的占位符
 * @param url 原始URL
 * @param transactionId 交易ID
 * @returns 替换占位符后的URL
 */
function replaceUrlPlaceholders(url: string, transactionId: string): string {
  // 替换 {transaction_id} 占位符
  return url.replace(/\{transaction_id\}/g, transactionId);
}

/**
 * 获取全局returnUrl配置并处理占位符
 * @param saleorApiUrl Saleor API URL
 * @param transactionId 交易ID
 * @returns 处理后的全局returnUrl
 */
async function getGlobalReturnUrlWithPlaceholders(
  saleorApiUrl: string,
  transactionId: string,
): Promise<string | null> {
  try {
    // 导入必要的模块
    const { createServerClient } = await import("@/lib/create-graphq-client");
    const { createPrivateSettingsManager } = await import(
      "@/modules/app-configuration/metadata-manager"
    );
    const { saleorApp } = await import("@/saleor-app");

    // 从APL获取认证信息
    const authData = await saleorApp.apl.get(saleorApiUrl);
    const token = authData?.token;

    if (!token) {
      logger.warn("SALEOR_APP_TOKEN not found in APL");
      return null;
    }

    // 创建GraphQL客户端和设置管理器
    const client = createServerClient(saleorApiUrl, token);
    const settingsManager = createPrivateSettingsManager(client);

    // 全局配置的metadata key
    const GLOBAL_CONFIG_KEY = "global_payment_config";

    // 获取全局配置
    const configStr = await settingsManager.get(saleorApiUrl, GLOBAL_CONFIG_KEY);
    if (configStr && typeof configStr === "string") {
      try {
        const config = JSON.parse(configStr) as { returnUrl?: string };
        if (config.returnUrl) {
          // 处理占位符
          return replaceUrlPlaceholders(config.returnUrl, transactionId);
        }
      } catch (e) {
        logger.error(
          "Failed to parse global config: " + (e instanceof Error ? e.message : "Unknown error"),
        );
      }
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : "未知错误",
        saleorApiUrl,
      },
      "获取全局returnUrl配置失败",
    );
  }

  return null;
}

/**
 * 彩虹易支付返回处理接口
 * 处理用户支付成功后跳转的请求，验证支付状态并返回相应状态
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info(
      {
        query: req.query,
        userAgent: req.headers["user-agent"],
      },
      "Epay return webhook called",
    );

    // 获取查询参数
    const { out_trade_no, trade_no, trade_status } = req.query;

    // 验证必要参数
    if (!out_trade_no || !trade_no || !trade_status) {
      logger.warn(
        {
          out_trade_no: out_trade_no || "missing",
          trade_no: trade_no || "missing",
          trade_status: trade_status || "missing",
        },
        "Missing required parameters",
      );
      // 直接返回未支付状态，不进行跳转
      return res.status(200).json({
        status: "UNPAID",
        message: "支付未完成",
      });
    }

    const orderNo = Array.isArray(out_trade_no) ? out_trade_no[0] : out_trade_no;
    const tradeNo = Array.isArray(trade_no) ? trade_no[0] : trade_no;
    const tradeStatus = Array.isArray(trade_status) ? trade_status[0] : trade_status;

    logger.info(
      {
        orderNo,
        tradeNo,
        tradeStatus,
      },
      "Processing epay return",
    );

    // 根据订单号查找订单映射记录
    let orderMapping: OrderMapping | null = null;
    try {
      const result = await db
        .select()
        .from(orderMappings)
        .where(eq(orderMappings.orderNo, orderNo))
        .limit(1);

      orderMapping = result[0] || null;
    } catch (dbError) {
      logger.error(
        {
          error: dbError instanceof Error ? dbError.message : "未知错误",
          stack: dbError instanceof Error ? dbError.stack : undefined,
          orderNo,
        },
        "数据库查询失败",
      );
    }

    // 获取支付响应数据
    let paymentResponse: PaymentResponse | null = null;
    if (orderMapping?.paymentResponse) {
      try {
        paymentResponse = JSON.parse(orderMapping.paymentResponse) as PaymentResponse;
      } catch (parseError) {
        logger.error(
          {
            error: parseError instanceof Error ? parseError.message : "未知错误",
            orderNo,
          },
          "解析支付响应数据失败",
        );
      }
    }

    // 如果是支付成功的状态
    if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
      logger.info(
        {
          orderNo,
          tradeNo,
          tradeStatus,
        },
        "支付成功，准备跳转",
      );

      // 首先尝试从支付响应数据中获取returnUrl
      if (paymentResponse?.returnUrl) {
        logger.info(
          {
            orderNo,
            returnUrl: paymentResponse.returnUrl,
          },
          "支付成功，跳转到客户端提供的returnUrl",
        );

        // 处理URL中的占位符
        const processedReturnUrl = replaceUrlPlaceholders(
          paymentResponse.returnUrl,
          orderMapping?.transactionId || orderNo,
        );

        // 执行302跳转到客户端提供的returnUrl
        return res.redirect(302, processedReturnUrl);
      }

      // 如果支付响应中没有returnUrl，尝试使用全局配置的returnUrl
      if (orderMapping?.saleorApiUrl) {
        const globalReturnUrl = await getGlobalReturnUrlWithPlaceholders(
          orderMapping.saleorApiUrl,
          orderMapping.transactionId || orderNo,
        );

        if (globalReturnUrl) {
          logger.info(
            {
              orderNo,
              globalReturnUrl,
            },
            "支付成功，跳转到全局returnUrl配置",
          );

          // 执行302跳转到全局returnUrl
          return res.redirect(302, globalReturnUrl);
        }
      }

      // 如果都没有returnUrl，关闭页面
      logger.info(
        {
          orderNo,
        },
        "支付成功，但未找到returnUrl，关闭页面",
      );
      // 返回HTML页面，包含关闭页面的JavaScript代码
      return res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
    <title>支付成功</title>
    <meta charset="UTF-8">
</head>
<body>
    <script>
        // 支付成功，关闭当前页面
        window.close();
        // 如果无法关闭（比如在浏览器标签页中打开），则显示成功信息
        document.body.innerHTML = '<h2>支付成功</h2><p>请手动关闭此页面</p>';
    </script>
</body>
</html>
`);
    } else {
      // 支付失败或其他状态
      logger.warn(
        {
          orderNo,
          tradeNo,
          tradeStatus,
        },
        "支付失败或未知状态",
      );

      // 返回未支付状态
      return res.status(200).json({
        status: "UNPAID",
        message: "支付未完成",
      });
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : "未知错误",
        stack: error instanceof Error ? error.stack : undefined,
        query: req.query,
      },
      "Epay return webhook error",
    );

    // 发生错误时也返回未支付状态
    return res.status(200).json({
      status: "UNPAID",
      message: "支付处理异常",
    });
  }
}
