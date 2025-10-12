import { createManifestHandler } from "@saleor/app-sdk/handlers/next";
import type { AppManifest } from "@saleor/app-sdk/types";

import packageJson from "../../../package.json";

/**
 * 从请求头中提取真实的基础URL
 * 考虑CDN和反向代理的情况
 */
function getRealAppBaseUrl(headers: { [key: string]: string | string[] | undefined }): string {
  // 尝试从常见的HTTP头字段中提取真实的基础URL
  const forwardedProto = headers["x-forwarded-proto"];
  const forwardedHost = headers["x-forwarded-host"];

  if (forwardedProto && forwardedHost) {
    const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
    const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
    return `${proto}://${host}`;
  }

  // 回退到host头
  const host = headers["host"];
  if (host) {
    const hostStr = Array.isArray(host) ? host[0] : host;
    // 默认使用https，除非明确指定是localhost
    const proto = hostStr.includes("localhost") ? "http" : "https";
    return `${proto}://${hostStr}`;
  }

  // 最后的回退方案
  return "https://example.com";
}

export default createManifestHandler({
  async manifestFactory({ appBaseUrl, request }) {
    // 记录manifest请求信息用于调试
    console.log('Manifest请求信息:', {
      appBaseUrl,
      headers: request?.headers,
      query: request?.query,
      url: request?.url,
    });

    // 优先使用环境变量，然后是从请求头推断的URL，最后使用默认的appBaseUrl
    const apiBaseURL = process.env.APP_API_BASE_URL ?? 
                      getRealAppBaseUrl(request?.headers || {}) ?? 
                      appBaseUrl;

    console.log('使用的API基础URL:', apiBaseURL);

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
      ],
      extensions: [],
    };

    return manifest;
  },
});
