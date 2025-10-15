import { saleorApp } from "./src/saleor-app";
import { siteManager } from "./src/lib/managers/site-manager";
import { type ExtendedAuthData } from "./src/lib/turso-apl";

// 简化版的注册处理程序，用于测试
export default async function handler() {
  try {
    console.log("Test register started");

    // 检查APL是否已配置
    const aplConfigured = await saleorApp.apl.isConfigured();
    console.log("APL配置状态:", aplConfigured);

    if (!aplConfigured.configured) {
      console.error("APL未正确配置:", aplConfigured.error?.message || "未知错误");
      return { success: false, error: "APL not configured" };
    }

    console.log("APL配置正确");
    return { success: true };
  } catch (error) {
    console.error("Registration test failed:", error instanceof Error ? error.message : "未知错误");
    return { success: false, error: "Registration test failed" };
  }
}

// 运行测试
handler().then((result) => {
  console.log("Test result:", result);
});
