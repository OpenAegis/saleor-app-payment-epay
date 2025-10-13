import path from "path";
import { SaleorApp } from "@saleor/app-sdk/saleor-app";
import { FileAPL } from "@saleor/app-sdk/APL";
import { isTest } from "./lib/isEnv";
import { TursoAPL } from "./lib/turso-apl";
import { createLogger } from "./lib/logger";

const logger = createLogger({ component: "SaleorApp" });

/**
 * 使用 TursoAPL 将认证数据存储在 Turso 数据库中
 * 这样可以在多个实例间共享认证数据，且与业务数据统一管理
 *
 * 暂时回退到 FileAPL，直到有认证数据时再切换到 TursoAPL
 */
const USE_TURSO_APL = false;

const getApl = async () => {
  if (isTest()) {
    const { TestAPL } = await import("./__tests__/testAPL");
    return new TestAPL();
  }

  if (USE_TURSO_APL) {
    try {
      const apl = new TursoAPL();
      // 检查APL是否配置正确
      const configured = await apl.isConfigured();
      if (configured.configured) {
        logger.info("✅ Using Turso APL");
        return apl;
      } else {
        logger.warn("⚠️ Turso APL not configured, falling back to FileAPL");
      }
    } catch (error) {
      logger.error(
        "❌ Error initializing Turso APL: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    }
  }

  // Fallback to FileAPL
  const authDataPath = path.join(process.cwd(), ".auth-data.json");
  logger.info("✅ Using File APL with path: " + authDataPath);
  return new FileAPL({ fileName: authDataPath });
};

const apl = await getApl();

export const saleorApp = new SaleorApp({
  apl,
});
