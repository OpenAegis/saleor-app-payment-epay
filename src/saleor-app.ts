import { SaleorApp } from "@saleor/app-sdk/saleor-app";
import { TursoAPL } from "./lib/turso-apl";
import { createLogger } from "./lib/logger";

const logger = createLogger({ component: "SaleorApp" });

/**
 * 使用 TursoAPL 将认证数据存储在 Turso 数据库中
 * 这样可以在多个实例间共享认证数据，且与业务数据统一管理
 */
const getApl = async () => {
  try {
    const apl = new TursoAPL();
    // 检查APL是否配置正确
    const configured = await apl.isConfigured();
    if (configured.configured) {
      logger.info("✅ Using Turso APL");
      return apl;
    } else {
      logger.error(
        "❌ Turso APL not configured: " + (configured.error?.message || "Unknown error"),
      );
      throw new Error(
        "Turso APL not configured: " + (configured.error?.message || "Unknown error"),
      );
    }
  } catch (error) {
    logger.error(
      "❌ Error initializing Turso APL: " +
        (error instanceof Error ? error.message : "Unknown error"),
    );
    throw error;
  }
};

const apl = await getApl();

export const saleorApp = new SaleorApp({
  apl,
});
