import path from "path";
import { SaleorApp } from "@saleor/app-sdk/saleor-app";
import { FileAPL } from "@saleor/app-sdk/APL";
import { isTest } from "./lib/isEnv";
import { TursoAPL } from "./lib/turso-apl";

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
    return new TursoAPL();
  }
  
  // Fallback to FileAPL
  const authDataPath = path.join(process.cwd(), ".auth-data.json");
  return new FileAPL({ fileName: authDataPath });
};

const apl = await getApl();

export const saleorApp = new SaleorApp({
  apl,
});
