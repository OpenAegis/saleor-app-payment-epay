import { createManifestHandler } from "@saleor/app-sdk/handlers/next";
import { AppManifest } from "@saleor/app-sdk/types";

import packageJson from "../../../package.json";

export default createManifestHandler({
  async manifestFactory(context: any) {
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
          name: "Transaction Action Request",
          asyncEvents: ["TRANSACTION_ACTION_REQUEST"],
          query: `
            subscription {
              event {
                ... on TransactionActionRequest {
                  action {
                    amount
                    currency
                    actionType
                  }
                  transaction {
                    id
                  }
                }
              }
            }
          `,
          targetUrl: `${context.appBaseUrl}/api/webhooks/transaction-action`,
          isActive: true,
        },
      ],
      extensions: [],
    };

    return manifest;
  },
});