import {
  type APL,
  type AplConfiguredResult,
  type AplReadyResult,
  type AuthData,
} from "@saleor/app-sdk/APL";
import { eq } from "drizzle-orm";
import { db } from "./db/turso-client";
import { sites } from "./db/schema";
import { createLogger } from "./logger";

// 扩展AuthData接口以包含站点信息
export interface ExtendedAuthData extends AuthData {
  siteId?: string;
  status?: string;
  notes?: string;
}

const logger = createLogger({ component: "TursoAPL" });

/**
 * Turso-based APL (Auth Persistence Layer)
 * 使用合并的sites表存储认证数据和站点信息
 */
export class TursoAPL implements APL {
  private initialized = false;

  /**
   * 初始化（检查sites表是否存在）
   */
  private async initTable() {
    if (this.initialized) return;

    try {
      // 检查sites表是否存在
      await db.select().from(sites).limit(1);
      this.initialized = true;
      logger.info("✅ Sites table is ready for APL operations");
    } catch (error) {
      logger.error(
        "❌ Sites table not available for APL operations: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
      throw error;
    }
  }

  async get(saleorApiUrl: string): Promise<AuthData | undefined> {
    await this.initTable();

    try {
      logger.info(`🔍 TursoAPL: Looking for auth data with URL: ${saleorApiUrl}`);

      const result = await db
        .select()
        .from(sites)
        .where(eq(sites.saleorApiUrl, saleorApiUrl))
        .limit(1);

      logger.info(`🔍 TursoAPL: Found ${result.length} rows for URL: ${saleorApiUrl}`);

      if (result.length === 0) {
        // 查找所有记录，看看数据库中有什么
        const allResult = await db.select({ saleorApiUrl: sites.saleorApiUrl }).from(sites).limit(5);
        const urls = allResult.map((r) => r.saleorApiUrl);
        logger.info(`🔍 TursoAPL: Available URLs in database: ${urls.join(", ")}`);
        return undefined;
      }

      const site = result[0];
      const authData: ExtendedAuthData = {
        saleorApiUrl: site.saleorApiUrl,
        domain: site.domain,
        token: site.token || "",
        appId: site.appId || "",
        jwks: site.jwks ? JSON.parse(site.jwks) as string : undefined,
        siteId: site.id,
        status: site.status,
        notes: site.notes || undefined,
      };

      logger.info(`✅ TursoAPL: Successfully retrieved auth data for domain: ${authData.domain}`);
      return authData;
    } catch (error) {
      logger.error(
        "❌ Failed to get auth data from Turso APL: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
      return undefined;
    }
  }

  async set(authData: AuthData | ExtendedAuthData): Promise<void> {
    await this.initTable();

    try {
      const jwksString = authData.jwks ? JSON.stringify(authData.jwks) : null;
      const extendedData = authData as ExtendedAuthData;

      // 检查是否已存在相同的 saleorApiUrl 记录
      const existing = await db
        .select()
        .from(sites)
        .where(eq(sites.saleorApiUrl, authData.saleorApiUrl))
        .limit(1);

      if (existing.length > 0) {
        // 更新现有记录
        await db
          .update(sites)
          .set({
            token: authData.token || null,
            appId: authData.appId || null,
            jwks: jwksString,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(sites.saleorApiUrl, authData.saleorApiUrl));
        
        logger.info(`✅ Auth data updated for API URL: ${authData.saleorApiUrl}`);
      } else {
        // 创建新记录，只插入必要字段，让数据库处理默认值
        const siteId = extendedData.siteId || `site-${Date.now()}`;
        
        // 构建基础插入数据，只包含必需字段
        const domainValue = authData.domain || "unknown";
        const insertData: {
          id: string;
          domain: string;
          name: string;
          saleorApiUrl: string;
          token?: string;
          appId?: string;
          jwks?: string;
          clientIP?: string;
        } = {
          id: siteId,
          domain: domainValue,
          name: `Saleor Store (${domainValue})`,
          saleorApiUrl: authData.saleorApiUrl,
        };

        // 只在有值时添加可选字段
        if (authData.token) insertData.token = authData.token;
        if (authData.appId) insertData.appId = authData.appId;
        if (jwksString) insertData.jwks = jwksString;

        logger.info(`🔄 Attempting to insert site data: ${JSON.stringify(insertData, null, 2)}`);
        await db.insert(sites).values(insertData);
        
        logger.info(`✅ Auth data created for API URL: ${authData.saleorApiUrl} (site: ${siteId})`);
      }
    } catch (error) {
      logger.error(
        "❌ Failed to save auth data to Turso APL: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
      throw error;
    }
  }

  async delete(saleorApiUrl: string): Promise<void> {
    await this.initTable();

    try {
      await db
        .delete(sites)
        .where(eq(sites.saleorApiUrl, saleorApiUrl));

      logger.info(`✅ Auth data deleted for API URL: ${saleorApiUrl}`);
    } catch (error) {
      logger.error(
        "❌ Failed to delete auth data from Turso APL: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
      throw error;
    }
  }

  async getAll(): Promise<ExtendedAuthData[]> {
    await this.initTable();

    try {
      const result = await db
        .select()
        .from(sites)
        .orderBy(sites.createdAt);

      return result.map((site): ExtendedAuthData => ({
        saleorApiUrl: site.saleorApiUrl,
        domain: site.domain,
        token: site.token || "",
        appId: site.appId || "",
        jwks: site.jwks ? JSON.parse(site.jwks) as string : undefined,
        siteId: site.id,
        status: site.status,
        notes: site.notes || undefined,
      }));
    } catch (error) {
      logger.error(
        "❌ Failed to get all auth data from Turso APL: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
      return [];
    }
  }

  async isReady(): Promise<AplReadyResult> {
    try {
      await this.initTable();
      return { ready: true };
    } catch (error) {
      return {
        ready: false,
        error: error instanceof Error ? error : new Error("Unknown error"),
      };
    }
  }

  async isConfigured(): Promise<AplConfiguredResult> {
    try {
      const readyResult = await this.isReady();
      if (!readyResult.ready) {
        return { configured: false, error: readyResult.error };
      }

      // 检查表是否存在且可访问
      await db.select().from(sites).limit(1);

      return { configured: true };
    } catch (error) {
      return {
        configured: false,
        error: error instanceof Error ? error : new Error("APL configuration error"),
      };
    }
  }

  /**
   * 根据站点ID获取认证数据
   */
  async getBySiteId(siteId: string): Promise<ExtendedAuthData | undefined> {
    await this.initTable();

    try {
      const result = await db
        .select()
        .from(sites)
        .where(eq(sites.id, siteId))
        .limit(1);

      if (result.length === 0) {
        return undefined;
      }

      const site = result[0];
      return {
        saleorApiUrl: site.saleorApiUrl,
        domain: site.domain,
        token: site.token || "",
        appId: site.appId || "",
        jwks: site.jwks ? JSON.parse(site.jwks) as string : undefined,
        siteId: site.id,
        status: site.status,
        notes: site.notes || undefined,
      };
    } catch (error) {
      logger.error(
        "❌ Failed to get auth data by site ID: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
      return undefined;
    }
  }

  /**
   * 更新认证数据的站点关联
   */
  async updateSiteAssociation(saleorApiUrl: string, siteId: string | null): Promise<void> {
    await this.initTable();

    try {
      await db
        .update(sites)
        .set({
          id: siteId || undefined,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(sites.saleorApiUrl, saleorApiUrl));

      logger.info(`✅ Updated site association for ${saleorApiUrl}: ${siteId || 'null'}`);
    } catch (error) {
      logger.error(
        "❌ Failed to update site association: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
      throw error;
    }
  }

  /**
   * 通过token查找认证数据（用于URL更新）
   * 如果token不匹配，尝试通过app ID匹配
   */
  async getByToken(token: string, appId?: string): Promise<ExtendedAuthData | undefined> {
    await this.initTable();

    try {
      // 首先尝试通过token匹配
      let result = await db
        .select()
        .from(sites)
        .where(eq(sites.token, token))
        .limit(1);

      logger.info(`🔍 Token search result: ${result.length} rows found for token: ${token}`);

      // 如果token匹配失败且提供了appId，尝试通过appId匹配
      if (result.length === 0 && appId) {
        logger.info(`🔄 Token not found, trying app ID: ${appId}`);
        result = await db
          .select()
          .from(sites)
          .where(eq(sites.appId, appId))
          .limit(1);

        logger.info(`🔍 App ID search result: ${result.length} rows found for app ID: ${appId}`);

        // 如果通过appId找到了记录，更新token
        if (result.length > 0) {
          const site = result[0];
          logger.info(`🔄 Updating token from ${site.token} to ${token}`);
          
          await db
            .update(sites)
            .set({
              token: token,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(sites.id, site.id));

          // 更新返回的数据
          result[0] = { ...site, token: token };
        }
      }

      if (result.length === 0) {
        logger.warn(`❌ No auth data found for token: ${token} or app ID: ${appId}`);
        return undefined;
      }

      const site = result[0];
      return {
        saleorApiUrl: site.saleorApiUrl,
        domain: site.domain,
        token: site.token || "",
        appId: site.appId || "",
        jwks: site.jwks ? JSON.parse(site.jwks) as string : undefined,
        siteId: site.id,
        status: site.status,
        notes: site.notes || undefined,
      };
    } catch (error) {
      logger.error(
        "❌ Failed to get auth data by token: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
      return undefined;
    }
  }

  /**
   * 获取授权状态的认证数据（需要有关联的已批准站点）
   */
  async getAuthorizedAuthData(): Promise<ExtendedAuthData[]> {
    await this.initTable();

    try {
      const result = await db
        .select()
        .from(sites)
        .where(eq(sites.status, "approved"))
        .orderBy(sites.createdAt);

      return result.map((site): ExtendedAuthData => ({
        saleorApiUrl: site.saleorApiUrl,
        domain: site.domain,
        token: site.token || "",
        appId: site.appId || "",
        jwks: site.jwks ? JSON.parse(site.jwks) as string : undefined,
        siteId: site.id,
        status: site.status,
        notes: site.notes || undefined,
      }));
    } catch (error) {
      logger.error(
        "❌ Failed to get authorized auth data: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
      return [];
    }
  }
}
