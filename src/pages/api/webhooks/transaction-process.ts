import type { NextApiRequest, NextApiResponse } from "next";
import { createEpayClient, type EpayConfig } from "@/lib/epay/client";
import { siteManager } from "@/lib/managers/site-manager";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ component: "TransactionProcessWebhook" });

// 定义事件数据接口
interface TransactionProcessEvent {
  action: {
    amount: string;
  };
  transaction: {
    id: string;
  };
  // Carry-over data from initialize step. We expect provider reference here.
  data?: unknown;
}

function parseEventData(raw: unknown): Record<string, unknown> {
  if (!raw) {
    return {};
  }

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : "未知错误" },
        "Failed to parse transaction event data as JSON string",
      );
      return {};
    }
  }

  if (typeof raw === "object") {
    return raw as Record<string, unknown>;
  }

  return {};
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

  let amountValue = 0;
  try {
    logger.info(
      {
        path: "/api/webhooks/transaction-process",
        method: req.method,
        saleorApiUrl: req.headers["saleor-api-url"],
        userAgent: req.headers["user-agent"],
        // 只记录请求体的结构信息，不记录具体内容以避免PII泄漏
        hasBody: !!req.body,
        bodyKeys: req.body ? Object.keys(req.body as Record<string, unknown>) : [],
      },
      "Process webhook called",
    );

    // 验证请求体结构
    if (!req.body) {
      logger.error({ hasBody: false }, "Request body is empty");
      return res.status(400).json({
        result: "CHARGE_FAILURE",
        amount: 0,
        message: "Request body is empty",
      });
    }

    // 检查 event 属性是否存在
    const body = req.body as Record<string, unknown>;
    let event: TransactionProcessEvent;

    if (body.event && typeof body.event === "object") {
      // 标准格式: { event: TransactionProcessEvent }
      event = body.event as TransactionProcessEvent;
    } else if (
      body.action &&
      body.transaction &&
      typeof body.action === "object" &&
      typeof body.transaction === "object"
    ) {
      // 直接格式: TransactionProcessEvent
      event = body as unknown as TransactionProcessEvent;
    } else {
      logger.error(
        {
          hasEvent: !!body.event,
          hasAction: !!body.action,
          hasTransaction: !!body.transaction,
        },
        "Invalid request body structure",
      );
      return res.status(400).json({
        result: "CHARGE_FAILURE",
        amount: 0,
        message: "Invalid request body structure",
      });
    }

    const parsedData = parseEventData(event.data);
    const { action, transaction } = event;
    amountValue = parseFloat(action.amount) || 0;
    logger.info(
      {
        transactionId: transaction.id,
        amount: amountValue,
        // 只记录 parsedData 的键，避免记录具体内容以防止PII泄漏
        parsedDataKeys: Object.keys(parsedData),
      },
      "Parsed transaction process payload",
    );

    // 获取Saleor API信息
    const saleorApiUrl = req.headers["saleor-api-url"] as string;
    const authToken = req.headers["authorization"]?.replace("Bearer ", "");

    // 验证必要参数
    if (!saleorApiUrl) {
      logger.warn("缺少Saleor API URL");
      return res.status(200).json({
        result: "CHARGE_FAILURE",
        amount: amountValue,
        message: "缺少Saleor API URL",
      });
    }

    // 对于某些 webhook，authorization header 可能是可选的
    // 使用 Saleor 签名验证或其他认证方式
    logger.info(
      {
        saleorApiUrl,
        hasAuthToken: Boolean(authToken),
        authTokenLength: authToken?.length || 0,
      },
      "Saleor API 信息检查",
    );

    // 检查站点授权
    const isSiteAuthorized = await checkSiteAuthorization(saleorApiUrl);
    if (!isSiteAuthorized) {
      return res.status(200).json({
        result: "CHARGE_FAILURE",
        amount: amountValue,
        message: "站点未授权使用支付功能",
      });
    }

    // 获取支付配置 - 从本地数据库
    // 这里我们需要从 parsedData 中获取 gatewayId，或者使用默认配置
    let epayConfig: EpayConfig | null = null;

    try {
      // 尝试从 parsedData 中获取支付响应信息
      const gatewayId = parsedData["gatewayId"] || parsedData["paymentMethodId"];

      logger.info(
        {
          transactionId: transaction.id,
          // 只记录是否存在 gatewayId，避免记录具体内容以防止PII泄漏
          hasGatewayId: !!gatewayId,
        },
        "尝试获取支付配置",
      );

      if (gatewayId && typeof gatewayId === "string") {
        // 使用与 transaction-initialize 相同的方法
        const { gatewayManager } = await import("@/lib/managers/gateway-manager");
        const gateway = await gatewayManager.get(gatewayId);

        if (gateway && gateway.enabled) {
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
              apiVersion: gateway.apiVersion,
            },
            "从本地数据库获取支付配置成功",
          );
        }
      }

      // 如果没有特定配置，尝试获取默认配置
      if (!epayConfig) {
        const { gatewayManager } = await import("@/lib/managers/gateway-manager");
        const enabledGateways = await gatewayManager.getEnabled();

        if (enabledGateways.length > 0) {
          const firstGateway = enabledGateways[0];
          epayConfig = {
            pid: firstGateway.epayPid,
            key: firstGateway.epayKey,
            rsaPrivateKey: firstGateway.epayRsaPrivateKey || undefined,
            apiUrl: firstGateway.epayUrl,
            apiVersion: (firstGateway.apiVersion as "v1" | "v2") || "v1",
            signType: (firstGateway.signType as "MD5" | "RSA") || "MD5",
          };

          logger.info(
            {
              gatewayId: firstGateway.id,
              gatewayName: firstGateway.name,
              apiVersion: firstGateway.apiVersion,
              signType: firstGateway.signType,
            },
            "使用默认网关配置",
          );
        }
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
      logger.warn("无法获取支付配置");
      return res.status(200).json({
        result: "CHARGE_FAILURE",
        amount: amountValue,
        message: "支付配置未找到，请在后台配置支付参数",
      });
    }

    logger.info(
      {
        saleorApiUrl,
        apiVersion: epayConfig.apiVersion,
        signType: epayConfig.signType,
        hasRsaKey: Boolean(epayConfig.rsaPrivateKey),
      },
      "从本地数据库加载支付配置用于处理",
    );

    const epayClient = createEpayClient(epayConfig);

    let epayOrderNo =
      parsedData["epayOrderNo"] || parsedData["pspReference"] || parsedData["externalId"];
    const saleorOrderNo = parsedData["saleorOrderNo"];

    // 如果没有从 parsedData 获取到订单号，尝试从订单映射表查找
    if (!epayOrderNo) {
      try {
        const { db } = await import("@/lib/db/turso-client");
        const { orderMappings } = await import("@/lib/db/schema");
        const { eq } = await import("drizzle-orm");

        const mapping = await db
          .select()
          .from(orderMappings)
          .where(eq(orderMappings.transactionId, transaction.id))
          .limit(1);

        if (mapping.length > 0) {
          epayOrderNo = mapping[0].orderNo;
          logger.info(
            {
              transactionId: transaction.id,
              foundOrderNo: epayOrderNo,
              mappingId: mapping[0].id,
            },
            "从订单映射表找到对应的订单号",
          );
        } else {
          logger.warn(
            {
              transactionId: transaction.id,
            },
            "在订单映射表中未找到对应的订单号",
          );
        }
      } catch (mappingError) {
        logger.error(
          {
            error: mappingError instanceof Error ? mappingError.message : "未知错误",
            transactionId: transaction.id,
          },
          "查询订单映射表失败",
        );
      }
    }

    logger.info(
      {
        transactionId: transaction.id,
        hasEpayOrderNo: !!epayOrderNo,
        hasSaleorOrderNo: !!saleorOrderNo,
        // 只记录 parsedData 的键，避免记录具体内容以防止PII泄漏
        parsedDataKeys: Object.keys(parsedData),
      },
      "支付订单查询参数",
    );

    // 检查是否有足够的信息进行查询
    if (!epayOrderNo && !transaction.id) {
      logger.warn(
        {
          transactionId: transaction.id,
          // 只记录 parsedData 的键，避免记录具体内容以防止PII泄漏
          parsedDataKeys: Object.keys(parsedData),
        },
        "缺少 epay 订单号和交易 ID，无法查询支付状态",
      );

      return res.status(200).json({
        result: "CHARGE_FAILURE",
        amount: amountValue,
        message: "缺少必要的订单信息，无法查询支付状态",
      });
    }

    // 使用 out_trade_no 参数查询我们自己生成的订单号
    // epayOrderNo 是我们自己生成的订单号，应该作为 out_trade_no 参数传递
    let result = await epayClient.queryOrder(epayOrderNo as string, true);
    logger.info(
      {
        transactionId: transaction.id,
        primaryQuery: epayOrderNo || transaction.id,
        useOutTradeNo: true, // 始终使用 out_trade_no 查询我们自己生成的订单号
        epayStatus: result.status,
        tradeStatus: result.trade_status,
      },
      "Queried Epay order (primary)",
    );

    if (!(result.status === 1 && result.trade_status === "TRADE_SUCCESS") && saleorOrderNo) {
      const fallback = await epayClient.queryOrder(saleorOrderNo as string, true);
      logger.info(
        {
          transactionId: transaction.id,
          hasSaleorOrderNo: !!saleorOrderNo,
          fallbackStatus: fallback.status,
          fallbackTradeStatus: fallback.trade_status,
        },
        "Queried Epay order (fallback)",
      );
      if (fallback.status !== undefined) {
        result = fallback;
      }
    }

    // 检查是否需要重新创建支付链接（订单不存在或已关闭）
    // 修改条件判断，正确处理订单不存在的情况
    if (
      result.status === 0 ||
      result.trade_status === "TRADE_CLOSED" ||
      result.trade_status === "NOTEXIST" ||
      !result.trade_status // 当 trade_status 为空时，也认为订单不存在
    ) {
      logger.info(
        {
          transactionId: transaction.id,
          epayStatus: result.status,
          tradeStatus: result.trade_status,
          message: result.msg,
        },
        "订单不存在或已关闭，尝试使用初始化时的支付链接",
      );

      // 检查 parsedData 中是否包含支付链接信息
      if (parsedData["paymentResponse"]) {
        const paymentResponse = parsedData["paymentResponse"] as Record<string, unknown>;
        if (paymentResponse["paymentUrl"] || paymentResponse["qrcode"]) {
          logger.info(
            {
              transactionId: transaction.id,
              hasPaymentUrl: !!paymentResponse["paymentUrl"],
              hasQrcode: !!paymentResponse["qrcode"],
            },
            "使用初始化时的支付链接",
          );

          // 直接返回初始化时的支付链接
          return res.status(200).json({
            result: "CHARGE_ACTION_REQUIRED",
            amount: amountValue,
            externalUrl: (paymentResponse["paymentUrl"] as string) || undefined,
            data: {
              paymentResponse: {
                paymentUrl: paymentResponse["paymentUrl"],
                qrcode: paymentResponse["qrcode"],
                epayOrderNo: paymentResponse["epayOrderNo"],
                saleorOrderNo: paymentResponse["saleorOrderNo"],
                payType: paymentResponse["payType"],
              },
            },
          });
        }
      }

      // 如果无法使用初始化时的支付链接，从数据库中获取订单信息
      try {
        const { db } = await import("@/lib/db/turso-client");
        const { orderMappings } = await import("@/lib/db/schema");
        const { eq } = await import("drizzle-orm");

        const mapping = await db
          .select()
          .from(orderMappings)
          .where(eq(orderMappings.transactionId, transaction.id))
          .limit(1);

        if (mapping.length > 0) {
          const orderInfo = mapping[0];

          // 检查 parsedData 中是否包含支付链接信息
          if (parsedData["paymentResponse"]) {
            const paymentResponse = parsedData["paymentResponse"] as Record<string, unknown>;
            if (paymentResponse["paymentUrl"] || paymentResponse["qrcode"]) {
              logger.info(
                {
                  transactionId: transaction.id,
                  hasPaymentUrl: !!paymentResponse["paymentUrl"],
                  hasQrcode: !!paymentResponse["qrcode"],
                },
                "使用初始化时的支付链接",
              );

              // 直接返回初始化时的支付链接
              return res.status(200).json({
                result: "CHARGE_ACTION_REQUIRED",
                amount: amountValue,
                externalUrl: (paymentResponse["paymentUrl"] as string) || undefined,
                data: {
                  paymentResponse: {
                    paymentUrl: paymentResponse["paymentUrl"],
                    qrcode: paymentResponse["qrcode"],
                    epayOrderNo: paymentResponse["epayOrderNo"],
                    saleorOrderNo: paymentResponse["saleorOrderNo"],
                    payType: paymentResponse["payType"],
                  },
                },
              });
            }
          }

          logger.warn(
            {
              transactionId: transaction.id,
              orderNo: orderInfo.orderNo,
            },
            "订单存在但无支付链接信息，无法重新创建支付链接",
          );
        } else {
          logger.warn(
            {
              transactionId: transaction.id,
            },
            "在订单映射表中未找到对应的订单号，无法重新创建支付链接",
          );
        }
      } catch (mappingError) {
        logger.error(
          {
            error: mappingError instanceof Error ? mappingError.message : "未知错误",
            transactionId: transaction.id,
          },
          "查询订单映射表失败",
        );
      }

      // 如果无法重新创建支付链接，返回失败
      return res.status(200).json({
        result: "CHARGE_FAILURE",
        amount: amountValue,
        message: "无法获取支付链接",
      });
    }

    if (result.status === 1 && result.trade_status === "TRADE_SUCCESS") {
      logger.info(
        {
          transactionId: transaction.id,
          epayTradeNo: result.trade_no,
          epayOrderNo: result.out_trade_no,
          chargedAmount: result.money,
        },
        "Epay order confirmed as success",
      );
      return res.status(200).json({
        result: "CHARGE_SUCCESS",
        amount: amountValue,
        pspReference: result.trade_no || result.out_trade_no,
        data: {
          paymentDetailsResponse: {
            epayTradeNo: result.trade_no,
            epayOrderNo: result.out_trade_no,
          },
        },
      });
    }

    // 当订单状态为待支付时，返回支付链接给前端
    if (result.status === 0 && (!result.trade_status || result.trade_status === "")) {
      logger.info(
        {
          transactionId: transaction.id,
          epayStatus: result.status,
          tradeStatus: result.trade_status,
          message: result.msg,
        },
        "Epay order is pending, need to return payment link",
      );

      // 检查 parsedData 中是否包含支付链接信息
      if (parsedData["paymentResponse"]) {
        const paymentResponse = parsedData["paymentResponse"] as Record<string, unknown>;
        if (paymentResponse["paymentUrl"] || paymentResponse["qrcode"]) {
          logger.info(
            {
              transactionId: transaction.id,
              hasPaymentUrl: !!paymentResponse["paymentUrl"],
              hasQrcode: !!paymentResponse["qrcode"],
            },
            "使用初始化时的支付链接",
          );

          // 直接返回初始化时的支付链接
          return res.status(200).json({
            result: "CHARGE_ACTION_REQUIRED",
            amount: amountValue,
            externalUrl: (paymentResponse["paymentUrl"] as string) || undefined,
            data: {
              paymentResponse: {
                paymentUrl: paymentResponse["paymentUrl"],
                qrcode: paymentResponse["qrcode"],
                epayOrderNo: paymentResponse["epayOrderNo"],
                saleorOrderNo: paymentResponse["saleorOrderNo"],
                payType: paymentResponse["payType"],
              },
            },
          });
        }
      }

      // 如果无法使用初始化时的支付链接，从数据库中获取订单信息
      try {
        const { db } = await import("@/lib/db/turso-client");
        const { orderMappings } = await import("@/lib/db/schema");
        const { eq } = await import("drizzle-orm");

        const mapping = await db
          .select()
          .from(orderMappings)
          .where(eq(orderMappings.transactionId, transaction.id))
          .limit(1);

        if (mapping.length > 0) {
          // 检查 parsedData 中是否包含支付链接信息
          if (parsedData["paymentResponse"]) {
            const paymentResponse = parsedData["paymentResponse"] as Record<string, unknown>;
            if (paymentResponse["paymentUrl"] || paymentResponse["qrcode"]) {
              logger.info(
                {
                  transactionId: transaction.id,
                  hasPaymentUrl: !!paymentResponse["paymentUrl"],
                  hasQrcode: !!paymentResponse["qrcode"],
                },
                "使用初始化时的支付链接",
              );

              // 直接返回初始化时的支付链接
              return res.status(200).json({
                result: "CHARGE_ACTION_REQUIRED",
                amount: amountValue,
                externalUrl: (paymentResponse["paymentUrl"] as string) || undefined,
                data: {
                  paymentResponse: {
                    paymentUrl: paymentResponse["paymentUrl"],
                    qrcode: paymentResponse["qrcode"],
                    epayOrderNo: paymentResponse["epayOrderNo"],
                    saleorOrderNo: paymentResponse["saleorOrderNo"],
                    payType: paymentResponse["payType"],
                  },
                },
              });
            }
          }

          logger.warn(
            {
              transactionId: transaction.id,
            },
            "订单存在但无支付链接信息，无法重新创建支付链接",
          );
        } else {
          logger.warn(
            {
              transactionId: transaction.id,
            },
            "在订单映射表中未找到对应的订单号，无法重新创建支付链接",
          );
        }
      } catch (mappingError) {
        logger.error(
          {
            error: mappingError instanceof Error ? mappingError.message : "未知错误",
            transactionId: transaction.id,
          },
          "查询订单映射表失败",
        );
      }

      // 如果无法重新创建支付链接，返回待处理状态
      return res.status(200).json({
        result: "CHARGE_REQUEST",
        amount: amountValue,
        message: result.msg || "支付处理中",
      });
    }

    if (result.status === 0 || result.trade_status === "TRADE_CLOSED") {
      logger.warn(
        {
          transactionId: transaction.id,
          epayStatus: result.status,
          tradeStatus: result.trade_status,
          message: result.msg,
        },
        "Epay order indicates failure/closed",
      );

      // 检查 parsedData 中是否包含支付链接信息
      if (parsedData["paymentResponse"]) {
        const paymentResponse = parsedData["paymentResponse"] as Record<string, unknown>;
        if (paymentResponse["paymentUrl"] || paymentResponse["qrcode"]) {
          logger.info(
            {
              transactionId: transaction.id,
              hasPaymentUrl: !!paymentResponse["paymentUrl"],
              hasQrcode: !!paymentResponse["qrcode"],
            },
            "使用初始化时的支付链接",
          );

          // 直接返回初始化时的支付链接
          return res.status(200).json({
            result: "CHARGE_ACTION_REQUIRED",
            amount: amountValue,
            externalUrl: (paymentResponse["paymentUrl"] as string) || undefined,
            data: {
              paymentResponse: {
                paymentUrl: paymentResponse["paymentUrl"],
                qrcode: paymentResponse["qrcode"],
                epayOrderNo: paymentResponse["epayOrderNo"],
                saleorOrderNo: paymentResponse["saleorOrderNo"],
                payType: paymentResponse["payType"],
              },
            },
          });
        }
      }

      // 如果无法使用初始化时的支付链接，从数据库中获取订单信息
      try {
        const { db } = await import("@/lib/db/turso-client");
        const { orderMappings } = await import("@/lib/db/schema");
        const { eq } = await import("drizzle-orm");

        const mapping = await db
          .select()
          .from(orderMappings)
          .where(eq(orderMappings.transactionId, transaction.id))
          .limit(1);

        if (mapping.length > 0) {
          // 检查 parsedData 中是否包含支付链接信息
          if (parsedData["paymentResponse"]) {
            const paymentResponse = parsedData["paymentResponse"] as Record<string, unknown>;
            if (paymentResponse["paymentUrl"] || paymentResponse["qrcode"]) {
              logger.info(
                {
                  transactionId: transaction.id,
                  hasPaymentUrl: !!paymentResponse["paymentUrl"],
                  hasQrcode: !!paymentResponse["qrcode"],
                },
                "使用初始化时的支付链接",
              );

              // 直接返回初始化时的支付链接
              return res.status(200).json({
                result: "CHARGE_ACTION_REQUIRED",
                amount: amountValue,
                externalUrl: (paymentResponse["paymentUrl"] as string) || undefined,
                data: {
                  paymentResponse: {
                    paymentUrl: paymentResponse["paymentUrl"],
                    qrcode: paymentResponse["qrcode"],
                    epayOrderNo: paymentResponse["epayOrderNo"],
                    saleorOrderNo: paymentResponse["saleorOrderNo"],
                    payType: paymentResponse["payType"],
                  },
                },
              });
            }
          }

          logger.warn(
            {
              transactionId: transaction.id,
            },
            "订单存在但无支付链接信息，无法重新创建支付链接",
          );
        } else {
          logger.warn(
            {
              transactionId: transaction.id,
            },
            "在订单映射表中未找到对应的订单号，无法重新创建支付链接",
          );
        }
      } catch (mappingError) {
        logger.error(
          {
            error: mappingError instanceof Error ? mappingError.message : "未知错误",
            transactionId: transaction.id,
          },
          "查询订单映射表失败",
        );
      }

      return res.status(200).json({
        result: "CHARGE_FAILURE",
        amount: amountValue,
        message: result.msg || "支付失败或已关闭",
      });
    }

    logger.info(
      {
        transactionId: transaction.id,
        epayStatus: result.status,
        tradeStatus: result.trade_status,
        message: result.msg,
      },
      "Epay order still pending",
    );

    // 检查 parsedData 中是否包含支付链接信息
    if (parsedData["paymentResponse"]) {
      const paymentResponse = parsedData["paymentResponse"] as Record<string, unknown>;
      if (paymentResponse["paymentUrl"] || paymentResponse["qrcode"]) {
        logger.info(
          {
            transactionId: transaction.id,
            hasPaymentUrl: !!paymentResponse["paymentUrl"],
            hasQrcode: !!paymentResponse["qrcode"],
          },
          "使用初始化时的支付链接",
        );

        // 直接返回初始化时的支付链接
        return res.status(200).json({
          result: "CHARGE_ACTION_REQUIRED",
          amount: amountValue,
          externalUrl: (paymentResponse["paymentUrl"] as string) || undefined,
          data: {
            paymentResponse: {
              paymentUrl: paymentResponse["paymentUrl"],
              qrcode: paymentResponse["qrcode"],
              epayOrderNo: paymentResponse["epayOrderNo"],
              saleorOrderNo: paymentResponse["saleorOrderNo"],
              payType: paymentResponse["payType"],
            },
          },
        });
      }
    }

    // 如果无法使用初始化时的支付链接，从数据库中获取订单信息
    try {
      const { db } = await import("@/lib/db/turso-client");
      const { orderMappings } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");

      const mapping = await db
        .select()
        .from(orderMappings)
        .where(eq(orderMappings.transactionId, transaction.id))
        .limit(1);

      if (mapping.length > 0) {
        // 检查 parsedData 中是否包含支付链接信息
        if (parsedData["paymentResponse"]) {
          const paymentResponse = parsedData["paymentResponse"] as Record<string, unknown>;
          if (paymentResponse["paymentUrl"] || paymentResponse["qrcode"]) {
            logger.info(
              {
                transactionId: transaction.id,
                hasPaymentUrl: !!paymentResponse["paymentUrl"],
                hasQrcode: !!paymentResponse["qrcode"],
              },
              "使用初始化时的支付链接",
            );

            // 直接返回初始化时的支付链接
            return res.status(200).json({
              result: "CHARGE_ACTION_REQUIRED",
              amount: amountValue,
              externalUrl: (paymentResponse["paymentUrl"] as string) || undefined,
              data: {
                paymentResponse: {
                  paymentUrl: paymentResponse["paymentUrl"],
                  qrcode: paymentResponse["qrcode"],
                  epayOrderNo: paymentResponse["epayOrderNo"],
                  saleorOrderNo: paymentResponse["saleorOrderNo"],
                  payType: paymentResponse["payType"],
                },
              },
            });
          }
        }

        logger.warn(
          {
            transactionId: transaction.id,
          },
          "订单存在但无支付链接信息，无法重新创建支付链接",
        );
      } else {
        logger.warn(
          {
            transactionId: transaction.id,
          },
          "在订单映射表中未找到对应的订单号，无法重新创建支付链接",
        );
      }
    } catch (mappingError) {
      logger.error(
        {
          error: mappingError instanceof Error ? mappingError.message : "未知错误",
          transactionId: transaction.id,
        },
        "查询订单映射表失败",
      );
    }

    return res.status(200).json({
      result: "CHARGE_REQUEST",
      amount: amountValue,
      message: result.msg || "支付处理中",
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : "未知错误",
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Transaction process error",
    );
    const message = error instanceof Error ? error.message : "未知错误";
    return res.status(200).json({
      result: "CHARGE_FAILURE",
      amount: amountValue,
      message,
    });
  }
}
