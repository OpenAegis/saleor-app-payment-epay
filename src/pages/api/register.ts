import { createAppRegisterHandler } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";
import { env } from "../../../src/lib/env.mjs";

const logger = createLogger({ component: "RegisterAPI" });

/**
 * 修正Saleor API URL
 * 如果URL是localhost，尝试从domain或环境变量构建正确的URL
 */
function correctSaleorApiUrl(saleorApiUrl: string, saleorDomain: string | undefined): string {
  try {
    // 检查是否为localhost URL
    const url = new URL(saleorApiUrl);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      logger.info("检测到localhost URL: " + saleorApiUrl + ", 尝试修正");

      // 首先尝试使用环境变量中的APP_URL
      if (env.APP_URL) {
        try {
          const appUrl = new URL(env.APP_URL);
          // 从APP_URL构建Saleor API URL（假设Saleor API在相同域名下）
          const correctedUrl = appUrl.origin + "/graphql/";
          logger.info("使用环境变量APP_URL修正URL从 " + saleorApiUrl + " 到 " + correctedUrl);
          return correctedUrl;
        } catch (error) {
          logger.warn(
            "无法从环境变量APP_URL构建URL: " +
              env.APP_URL +
              ", 错误: " +
              (error instanceof Error ? error.message : "未知错误"),
          );
        }
      }

      // 从domain构建正确的URL
      if (saleorDomain) {
        try {
          // 检查domain是否也是localhost，如果是则跳过
          if (!saleorDomain.includes("localhost") && !saleorDomain.includes("127.0.0.1")) {
            const domainUrl = new URL("https://" + saleorDomain);
            const correctedUrl = "https://" + domainUrl.hostname + "/graphql/";
            logger.info("从domain修正URL从 " + saleorApiUrl + " 到 " + correctedUrl);
            return correctedUrl;
          } else {
            logger.warn("domain也是localhost，无法用于修正URL: " + saleorDomain);
          }
        } catch (error) {
          logger.warn(
            "无法从domain构建URL: " +
              saleorDomain +
              ", 错误: " +
              (error instanceof Error ? error.message : "未知错误"),
          );
        }
      }

      // 如果无法从环境变量或domain构建，至少确保协议是https
      const correctedUrl =
        "https://" + url.hostname + (url.port ? ":" + url.port : "") + url.pathname;
      logger.info("修正localhost协议从 " + saleorApiUrl + " 到 " + correctedUrl);
      return correctedUrl;
    }
  } catch (error) {
    logger.error(
      "解析URL时出错: " +
        saleorApiUrl +
        ", 错误: " +
        (error instanceof Error ? error.message : "未知错误"),
    );
  }

  // 如果不需要修正，返回原始URL
  return saleorApiUrl;
}

/**
 * Required endpoint, called by Saleor to install app.
 * It will exchange tokens with app, so saleorApp.apl will contain token
 */
export default createAppRegisterHandler({
  apl: saleorApp.apl,

  /**
   * Allow all Saleor URLs for installation
   * You can restrict this to specific domains if needed
   */
  allowedSaleorUrls: [
    (_saleorApiUrl: string) => {
      return true;
    },
  ],

  /**
   * 记录请求开始并输出所有请求内容
   */
  onRequestStart: async (request) => {
    logger.info("Register请求开始");
    logger.info("请求方法: " + request.method);
    logger.info("请求URL: " + request.url);
    logger.info("请求头信息: " + JSON.stringify(request.headers));
    logger.info("请求参数: " + JSON.stringify(request.params));
  },

  /**
   * 修正authData中的saleorApiUrl
   */
  onRequestVerified: async (request, { authData }) => {
    logger.info("开始修正authData中的saleorApiUrl: " + authData.saleorApiUrl);
    logger.info("原始authData: " + JSON.stringify(authData));

    // 修正saleorApiUrl
    const correctedUrl = correctSaleorApiUrl(authData.saleorApiUrl, authData.domain);
    if (correctedUrl !== authData.saleorApiUrl) {
      logger.info("修正了saleorApiUrl: " + authData.saleorApiUrl + " -> " + correctedUrl);
      authData.saleorApiUrl = correctedUrl;
    }

    logger.info("修正后的authData: " + authData.saleorApiUrl);
    logger.info("完整修正后的authData: " + JSON.stringify(authData));
  },

  /**
   * 记录APL保存成功
   */
  onAuthAplSaved: async (request, { authData }) => {
    logger.info("AuthData已成功保存到APL");
    logger.info("保存的authData: " + JSON.stringify(authData));
  },

  /**
   * 记录APL保存失败
   */
  onAplSetFailed: async (request, { authData, error }) => {
    logger.error(
      "AuthData保存到APL失败: " + (error instanceof Error ? error.message : String(error)),
    );
    logger.error("失败的authData: " + JSON.stringify(authData));
  },
});
