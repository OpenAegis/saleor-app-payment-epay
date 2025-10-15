import { SaleorApp } from "@saleor/app-sdk/saleor-app";
import { type AuthData } from "@saleor/app-sdk/APL";
import { TursoAPL, type ExtendedAuthData } from "./lib/turso-apl";
import { createLogger } from "./lib/logger";

const logger = createLogger({ component: "SaleorApp" });

/**
 * 使用 TursoAPL 将认证数据存储在 Turso 数据库中
 * 这样可以在多个实例间共享认证数据，且与业务数据统一管理
 */
class LazyTursoAPL {
  private apl: TursoAPL | null = null;
  private initPromise: Promise<TursoAPL> | null = null;

  private async initialize(): Promise<TursoAPL> {
    if (this.apl) {
      return this.apl;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.createAPL();
    this.apl = await this.initPromise;
    return this.apl;
  }

  private async createAPL(): Promise<TursoAPL> {
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
  }

  async get(saleorApiUrl: string) {
    const apl = await this.initialize();
    return apl.get(saleorApiUrl);
  }

  async set(authData: AuthData | ExtendedAuthData) {
    const apl = await this.initialize();
    return apl.set(authData);
  }

  async delete(saleorApiUrl: string) {
    const apl = await this.initialize();
    return apl.delete(saleorApiUrl);
  }

  async getAll() {
    const apl = await this.initialize();
    return apl.getAll();
  }

  async isReady() {
    try {
      const apl = await this.initialize();
      return await apl.isReady();
    } catch (error) {
      return {
        ready: false,
        error: error instanceof Error ? error : new Error("Unknown error"),
      };
    }
  }

  async isConfigured() {
    try {
      const apl = await this.initialize();
      return await apl.isConfigured();
    } catch (error) {
      return {
        configured: false,
        error: error instanceof Error ? error : new Error("Unknown error"),
      };
    }
  }

  // 添加getByToken方法以兼容update-saleor-url.ts中的调用
  async getByToken(token: string, appId?: string) {
    const apl = await this.initialize();
    // 检查apl是否有getByToken方法
    if ("getByToken" in apl && typeof apl.getByToken === "function") {
      return apl.getByToken(token, appId);
    }
    // 如果没有getByToken方法，返回undefined
    return undefined;
  }
}

const lazyApl = new LazyTursoAPL();

export const saleorApp = new SaleorApp({
  apl: lazyApl,
});
