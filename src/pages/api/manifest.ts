import { createManifestHandler } from "@saleor/app-sdk/handlers/next";
import type { AppManifest } from "@saleor/app-sdk/types";

import packageJson from "../../../package.json";

export default createManifestHandler({
  async manifestFactory(context) {
    const manifest: AppManifest = {
      name: packageJson.name,
      tokenTargetUrl: `${context.appBaseUrl}/api/register`,
      appUrl: `${context.appBaseUrl}/config`,
      permissions: ["HANDLE_PAYMENTS"],
      id: "saleor.app.epay",
      version: packageJson.version,
      requiredSaleorVersion: ">=3.13",
      webhooks: [
        {
          name: "Transaction Initialize",
          syncEvents: ["TRANSACTION_INITIALIZE_SESSION"],
          query:
            "subscription { event { ... on TransactionInitializeSession { action { amount, currency, actionType }, transaction { id, reference }, sourceObject { ... on Checkout { id, email, totalPrice { gross { amount, currency } } }, ... on Order { id, email, total { gross { amount, currency } } } } } } }",
          targetUrl: `${context.appBaseUrl}/api/webhooks/transaction-initialize`,
          isActive: true,
        },
        {
          name: "Transaction Process",
          syncEvents: ["TRANSACTION_PROCESS_SESSION"],
          query:
            "subscription { event { ... on TransactionProcessSession { action { amount, currency, actionType }, transaction { id, reference }, sourceObject { ... on Checkout { id }, ... on Order { id } } } } }",
          targetUrl: `${context.appBaseUrl}/api/webhooks/transaction-process`,
          isActive: true,
        },
      ],
      extensions: [],
    };

    return manifest;
  },
});
