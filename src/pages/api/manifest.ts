import { createManifestHandler } from "@saleor/app-sdk/handlers/next";
import type { AppManifest } from "@saleor/app-sdk/types";

import packageJson from "../../../package.json";
import { env } from "../../../src/lib/env.mjs";

export default createManifestHandler({
  async manifestFactory({ appBaseUrl, request }) {
    // 记录manifest请求信息用于调试
    console.log("Manifest请求信息:", {
      appBaseUrl,
      headers: request?.headers,
      query: request?.query,
      url: request?.url,
    });

    // 优先使用环境变量APP_API_BASE_URL，然后使用Saleor App SDK提供的appBaseUrl
    const apiBaseURL = env.APP_API_BASE_URL ?? appBaseUrl;

    console.log("使用的API基础URL:", apiBaseURL);

    const manifest: AppManifest = {
      name: packageJson.name,
      tokenTargetUrl: `${apiBaseURL}/api/register`,
      appUrl: `${apiBaseURL}/config`,
      permissions: ["HANDLE_PAYMENTS"],
      id: "saleor.app.epay",
      version: packageJson.version,
      requiredSaleorVersion: ">=3.13",
      webhooks: [
        {
          name: "Payment List Gateways",
          syncEvents: ["PAYMENT_LIST_GATEWAYS" as unknown as never],
          query: "subscription { event { ... on PaymentListGateways { checkout { id } } } }",
          targetUrl: `${apiBaseURL}/api/webhooks/payment-list-gateways`,
          isActive: true,
        },
        {
          name: "Transaction Initialize",
          syncEvents: ["TRANSACTION_INITIALIZE_SESSION"],
          query:
            "subscription { event { ... on TransactionInitializeSession { action { amount, currency, actionType }, transaction { id, pspReference }, sourceObject { ... on Checkout { id, email, totalPrice { gross { amount, currency } } }, ... on Order { id, userEmail, total { gross { amount, currency } } } } } } }",
          targetUrl: `${apiBaseURL}/api/webhooks/transaction-initialize`,
          isActive: true,
        },
        {
          name: "Transaction Process",
          syncEvents: ["TRANSACTION_PROCESS_SESSION"],
          query:
            "subscription { event { ... on TransactionProcessSession { action { amount, currency, actionType }, transaction { id, pspReference }, sourceObject { ... on Checkout { id }, ... on Order { id } } } } }",
          targetUrl: `${apiBaseURL}/api/webhooks/transaction-process`,
          isActive: true,
        },
        {
          name: "Epay Notify",
          syncEvents: [],
          query: "subscription { event { __typename } }",
          targetUrl: `${apiBaseURL}/api/webhooks/epay-notify`,
          isActive: true,
        },
      ],
      extensions: [],
    };

    return manifest;
  },
});
