import {
  type APL,
  type AplConfiguredResult,
  type AplReadyResult,
  type AuthData,
} from "@saleor/app-sdk/APL";

// 扩展AuthData接口以包含站点关联
export interface ExtendedAuthData extends AuthData {
  siteId?: string;
}
import { tursoClient } from "./db/turso-client";
import { createLogger } from "./logger";

const logger = createLogger({ component: "TursoAPL" });

/**
 * Turso-based APL (Auth Persistence Layer)
 * 将 Saleor 应用的认证数据存储在 Turso 数据库中
 */
export class TursoAPL implements APL {
  private tableName = "saleor_auth_data";
  private initialized = false;

  /**
   * 初始化认证数据表
   */
  private async initTable() {
    if (this.initialized) return;

    try {
      // 创建saleor_auth_data表，与sites表关联
      await tursoClient.execute(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          saleor_api_url TEXT PRIMARY KEY,
          domain TEXT NOT NULL,
          token TEXT NOT NULL,
          app_id TEXT NOT NULL,
          jwks TEXT,
          site_id TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
        )
      `);

      await tursoClient.execute(`
        CREATE INDEX IF NOT EXISTS auth_data_domain_idx ON ${this.tableName}(domain)
      `);

      await tursoClient.execute(`
        CREATE INDEX IF NOT EXISTS auth_data_app_id_idx ON ${this.tableName}(app_id)
      `);

      await tursoClient.execute(`
        CREATE INDEX IF NOT EXISTS auth_data_site_id_idx ON ${this.tableName}(site_id)
      `);

      this.initialized = true;
      logger.info("✅ Turso APL table initialized successfully with site relationship");
    } catch (error) {
      logger.error(
        "❌ Failed to initialize Turso APL table: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
      throw error;
    }
  }

  async get(saleorApiUrl: string): Promise<AuthData | undefined> {
    await this.initTable();

    try {
      logger.info(`🔍 TursoAPL: Looking for auth data with URL: ${saleorApiUrl}`);

      const result = await tursoClient.execute(
        `SELECT * FROM ${this.tableName} WHERE saleor_api_url = ?`,
        [saleorApiUrl],
      );

      logger.info(`🔍 TursoAPL: Found ${result.rows.length} rows for URL: ${saleorApiUrl}`);

      if (result.rows.length === 0) {
        // 也试试查找所有记录，看看数据库中有什么
        const allResult = await tursoClient.execute(
          `SELECT saleor_api_url FROM ${this.tableName} LIMIT 5`,
        );
        const urls = allResult.rows.map((r) => r.saleor_api_url as string);
        logger.info(`🔍 TursoAPL: Available URLs in database: ${urls.join(", ")}`);
        return undefined;
      }

      const row = result.rows[0];
      const authData: ExtendedAuthData = {
        saleorApiUrl: row.saleor_api_url as string,
        domain: row.domain as string,
        token: row.token as string,
        appId: row.app_id as string,
        jwks: row.jwks ? (JSON.parse(row.jwks as string) as string) : undefined,
        siteId: row.site_id as string | undefined,
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
      const jwksString = authData.jwks ? JSON.stringify(authData.jwks) : "";
      const extendedData = authData as ExtendedAuthData;

      await tursoClient.execute(
        `INSERT OR REPLACE INTO ${this.tableName} 
         (saleor_api_url, domain, token, app_id, jwks, site_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          authData.saleorApiUrl || "",
          authData.domain || "",
          authData.token || "",
          authData.appId || "",
          jwksString || "",
          extendedData.siteId || null,
        ],
      );

      logger.info(`✅ Auth data saved for domain: ${authData.domain}${extendedData.siteId ? ` (site: ${extendedData.siteId})` : ""}`);
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
      await tursoClient.execute(`DELETE FROM ${this.tableName} WHERE saleor_api_url = ?`, [
        saleorApiUrl,
      ]);

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
      const result = await tursoClient.execute(
        `SELECT * FROM ${this.tableName} ORDER BY created_at DESC`,
      );

      return result.rows.map((row): ExtendedAuthData => ({
        saleorApiUrl: row.saleor_api_url as string,
        domain: row.domain as string,
        token: row.token as string,
        appId: row.app_id as string,
        jwks: row.jwks ? (JSON.parse(row.jwks as string) as string) : undefined,
        siteId: row.site_id as string | undefined,
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
      await tursoClient.execute(`SELECT COUNT(*) as count FROM ${this.tableName}`);

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
      const result = await tursoClient.execute(
        `SELECT * FROM ${this.tableName} WHERE site_id = ?`,
        [siteId],
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      const row = result.rows[0];
      return {
        saleorApiUrl: row.saleor_api_url as string,
        domain: row.domain as string,
        token: row.token as string,
        appId: row.app_id as string,
        jwks: row.jwks ? (JSON.parse(row.jwks as string) as string) : undefined,
        siteId: row.site_id as string,
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
      await tursoClient.execute(
        `UPDATE ${this.tableName} SET site_id = ?, updated_at = datetime('now') WHERE saleor_api_url = ?`,
        [siteId, saleorApiUrl],
      );

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
   * 获取授权状态的认证数据（需要有关联的已批准站点）
   */
  async getAuthorizedAuthData(): Promise<ExtendedAuthData[]> {
    await this.initTable();

    try {
      const result = await tursoClient.execute(`
        SELECT a.* FROM ${this.tableName} a
        INNER JOIN sites s ON a.site_id = s.id
        WHERE s.status = 'approved'
        ORDER BY a.created_at DESC
      `);

      return result.rows.map((row): ExtendedAuthData => ({
        saleorApiUrl: row.saleor_api_url as string,
        domain: row.domain as string,
        token: row.token as string,
        appId: row.app_id as string,
        jwks: row.jwks ? (JSON.parse(row.jwks as string) as string) : undefined,
        siteId: row.site_id as string,
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
