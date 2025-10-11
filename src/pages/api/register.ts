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
  allowedSaleorUrls: async (saleorApiUrl, request) => {
    try {
      // 从请求中提取站点信息
      const url = new URL(saleorApiUrl);
      const domain = url.hostname;
      
      console.log(`🔔 新站点安装请求: ${domain}`);
      
      // 检查站点是否已注册
      let site = await siteManager.getByDomain(domain);
      
      if (!site) {
        // 首次安装，注册站点
        site = await siteManager.register({
          domain,
          name: domain, // 默认使用域名作为名称
          saleorApiUrl,
          appId: undefined, // 稍后从Saleor获取
          status: "pending",
        });
        
        console.log(`📝 站点已注册，等待管理员审批: ${domain}`);
      } else {
        // 更新最后活跃时间
        await siteManager.updateLastActive(domain);
        console.log(`🔄 站点重新安装: ${domain}, 状态: ${site.status}`);
      }
      
      // 检查站点是否被授权
      const isAuthorized = await siteManager.isAuthorized(domain);
      
      if (!isAuthorized) {
        console.log(`❌ 站点未授权: ${domain}`);
        return false; // 拒绝安装
      }
      
      console.log(`✅ 站点授权通过: ${domain}`);
      return true; // 允许安装
      
    } catch (error) {
      console.error("站点授权检查失败:", error);
      return false; // 出错时拒绝安装
    }
  },
});
