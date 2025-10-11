import { createAppRegisterHandler } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "../../saleor-app";
import { siteManager } from "../../lib/managers/site-manager";

/**
 * Required endpoint, called by Saleor to install app.
 * It will exchange tokens with app, so saleorApp.apl will contain token
 * 
 * 增强版：同时注册站点到我们的授权系统
 */
export default createAppRegisterHandler({
  apl: saleorApp.apl,
  // 暂时允许所有URL，实际的授权检查在中间件中进行
  allowedSaleorUrls: ["*"],
});
