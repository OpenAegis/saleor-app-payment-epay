import { createManifestHandler } from "@saleor/app-sdk/handlers/next";
import type { AppManifest } from "@saleor/app-sdk/types";

import packageJson from "../../../package.json";
import { env } from "../../../src/lib/env.mjs";
import { createLogger } from "../../../src/lib/logger";

const logger = createLogger({ component: "ManifestAPI" });

export default createManifestHandler({
  async manifestFactory({ appBaseUrl, request: _request }) {
    logger.info("Manifest request received");

    // 优先使用环境变量APP_API_BASE_URL，然后使用Saleor App SDK提供的appBaseUrl
    const apiBaseURL = env.APP_API_BASE_URL ?? appBaseUrl;

    logger.info("Using API base URL: " + apiBaseURL);

    const manifest: AppManifest = {
      name: packageJson.name,
      tokenTargetUrl: `${apiBaseURL}/api/register`,
      appUrl: `${apiBaseURL}/config`,
      permissions: ["HANDLE_PAYMENTS", "MANAGE_ORDERS", "MANAGE_CHECKOUTS"],
      id: "saleor.app.epay",
      version: packageJson.version,
      requiredSaleorVersion: ">=3.13", // 修改为支持3.13及以上版本
      about:
        "App that allows merchants using the Saleor e-commerce platform to accept online payments from customers using Epay as their payment processor.",
      author: "Epay Payment App",
      brand: {
        logo: {
          default: `${apiBaseURL}/logo.png`,
        },
      },
      dataPrivacyUrl: `${apiBaseURL}/privacy`,
      homepageUrl: "https://github.com/your-org/saleor-app-payment-epay",
      supportUrl: `${apiBaseURL}/support`,
      webhooks: [
        {
          name: "Transaction Initialize",
          syncEvents: ["TRANSACTION_INITIALIZE_SESSION"],
          query:
            "subscription { event { __typename ... on TransactionInitializeSession { action { amount, currency, actionType }, data, transaction { id } } } }",
          targetUrl: `${apiBaseURL}/api/webhooks/transaction-initialize`,
          isActive: true,
        },
        {
          name: "Transaction Process",
          syncEvents: ["TRANSACTION_PROCESS_SESSION"],
          query:
            "subscription { event { __typename ... on TransactionProcessSession { action { amount, currency, actionType }, data, transaction { id } } } }",
          targetUrl: `${apiBaseURL}/api/webhooks/transaction-process`,
          isActive: true,
        },
      ],
      extensions: [],
    };

    return manifest;
  },
});
