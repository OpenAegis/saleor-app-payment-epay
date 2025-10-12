import { eq, desc } from "drizzle-orm";
import { db } from "../db/turso-client";
import { sites, type Site, type NewSite } from "../db/schema";
import { randomId } from "../random-id";
import { saleorValidator } from "../saleor-validator";
import { createLogger } from "../logger";

const logger = createLogger({ component: "SiteManager" });

/**
 * 站点管理器
 * 管理Saleor站点的授权和访问控制
 */
export class SiteManager {
  /**
   * 注册新站点（当站点安装插件时自动调用）
   */
  async register(input: Omit<NewSite, "id" | "createdAt" | "updatedAt" | "requestedAt">): Promise<Site> {
    logger.info({ domain: input.domain, saleorApiUrl: input.saleorApiUrl }, "开始注册新站点");

    let shopName = `Saleor Store (${input.domain})`;
    let validationNotes = "";

    // 尝试验证 Saleor URL，但不阻止注册
    try {
      const validation = await saleorValidator.validateSaleorUrl(input.saleorApiUrl);
      if (validation.isValid) {
        logger.info({ 
          domain: input.domain, 
          saleorApiUrl: input.saleorApiUrl,
          shopName: validation.shopName 
        }, "Saleor URL 验证通过");
        shopName = validation.shopName || shopName;
      } else {
        logger.warn({ 
          domain: input.domain, 
          saleorApiUrl: input.saleorApiUrl,
          error: validation.error 
        }, "Saleor URL 验证失败，但允许注册");
        validationNotes = `验证失败: ${validation.error}`;
      }
    } catch (error) {
      logger.warn({ 
        domain: input.domain, 
        saleorApiUrl: input.saleorApiUrl,
        error: error instanceof Error ? error.message : "未知错误"
      }, "Saleor URL 验证异常，但允许注册");
      validationNotes = `验证异常: ${error instanceof Error ? error.message : "未知错误"}`;
    }

    // 尝试验证域名匹配，但不阻止注册
    try {
      const domainMatch = await saleorValidator.validateDomainMatch(input.domain, input.saleorApiUrl);
      if (!domainMatch) {
        logger.warn({ 
          domain: input.domain, 
          saleorApiUrl: input.saleorApiUrl 
        }, "域名与 Saleor API URL 不匹配，但允许注册");
        validationNotes += validationNotes ? " | 域名不匹配" : "域名不匹配";
      }
    } catch (error) {
      logger.warn({ 
        domain: input.domain, 
        saleorApiUrl: input.saleorApiUrl,
        error: error instanceof Error ? error.message : "未知错误"
      }, "域名验证异常，但允许注册");
      validationNotes += validationNotes ? " | 域名验证异常" : "域名验证异常";
    }

    // 检查是否已经存在相同的域名或API URL
    const existingSite = await this.getByDomain(input.domain);
    if (existingSite) {
      logger.warn({ domain: input.domain, existingId: existingSite.id }, "站点域名已存在");
      throw new Error("该域名已经注册过了");
    }

    const now = new Date().toISOString();
    const site: NewSite = {
      id: randomId(),
      ...input,
      name: shopName, // 使用从验证中获取的商店名称
      notes: validationNotes || undefined, // 包含验证注释
      status: "pending", // 默认待审批
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(sites).values(site);
    logger.info({ id: site.id, domain: input.domain }, "站点注册成功");
    
    return site as Site;
  }

  /**
   * 获取单个站点
   */
  async get(id: string): Promise<Site | null> {
    const result = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    return result[0] || null;
  }

  /**
   * 通过域名获取站点
   */
  async getByDomain(domain: string): Promise<Site | null> {
    const result = await db.select().from(sites).where(eq(sites.domain, domain)).limit(1);
    return result[0] || null;
  }

  /**
   * 通过IP地址获取站点
   */
  async getByIP(ip: string): Promise<Site | null> {
    // 获取所有站点，然后手动过滤备注中包含IP的记录
    const result = await db.select().from(sites);
    
    // 手动过滤结果以查找包含IP的记录
    const filtered = result.filter(site => site.notes && site.notes.includes(ip));
    return filtered[0] || null;
  }

  /**
   * 获取所有站点
   */
  async getAll(): Promise<Site[]> {
    const result = await db
      .select()
      .from(sites)
      .orderBy(desc(sites.requestedAt));
    
    return result;
  }

  /**
   * 按状态获取站点
   */
  async getByStatus(status: "pending" | "approved" | "rejected" | "suspended"): Promise<Site[]> {
    const result = await db
      .select()
      .from(sites)
      .where(eq(sites.status, status))
      .orderBy(desc(sites.requestedAt));
    
    return result;
  }

  /**
   * 获取待审批站点
   */
  async getPendingSites(): Promise<Site[]> {
    return this.getByStatus("pending");
  }

  /**
   * 获取已批准站点
   */
  async getApprovedSites(): Promise<Site[]> {
    return this.getByStatus("approved");
  }

  /**
   * 审批站点
   */
  async approve(id: string, approvedBy: string, notes?: string): Promise<Site | null> {
    const now = new Date().toISOString();
    
    const result = await db
      .update(sites)
      .set({
        status: "approved",
        approvedAt: now,
        approvedBy,
        notes,
        updatedAt: now,
      })
      .where(eq(sites.id, id))
      .returning();

    return result[0] || null;
  }

  /**
   * 拒绝站点
   */
  async reject(id: string, rejectedBy: string, notes?: string): Promise<Site | null> {
    const now = new Date().toISOString();
    
    const result = await db
      .update(sites)
      .set({
        status: "rejected",
        approvedBy: rejectedBy, // 复用字段记录操作人
        notes,
        updatedAt: now,
      })
      .where(eq(sites.id, id))
      .returning();

    return result[0] || null;
  }

  /**
   * 暂停站点访问
   */
  async suspend(id: string, suspendedBy: string, notes?: string): Promise<Site | null> {
    const now = new Date().toISOString();
    
    const result = await db
      .update(sites)
      .set({
        status: "suspended",
        approvedBy: suspendedBy, // 复用字段记录操作人
        notes,
        updatedAt: now,
      })
      .where(eq(sites.id, id))
      .returning();

    return result[0] || null;
  }

  /**
   * 恢复站点访问
   */
  async restore(id: string, restoredBy: string, notes?: string): Promise<Site | null> {
    const now = new Date().toISOString();
    
    const result = await db
      .update(sites)
      .set({
        status: "approved",
        approvedBy: restoredBy,
        notes,
        updatedAt: now,
      })
      .where(eq(sites.id, id))
      .returning();

    return result[0] || null;
  }

  /**
   * 更新站点最后活跃时间
   */
  async updateLastActive(domain: string): Promise<void> {
    const now = new Date().toISOString();
    
    await db
      .update(sites)
      .set({
        lastActiveAt: now,
        updatedAt: now,
      })
      .where(eq(sites.domain, domain));
  }

  /**
   * 检查站点是否被授权访问（支持域名和IP两种方式）
   */
  async isAuthorized(domain: string, clientIP?: string): Promise<boolean> {
    // 首先检查域名授权
    const site = await this.getByDomain(domain);
    if (site?.status === "approved") {
      return true;
    }
    
    // 如果域名未授权且提供了客户端IP，检查IP授权
    if (clientIP) {
      const ipSite = await this.getByIP(clientIP);
      if (ipSite?.status === "approved") {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 删除站点
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(sites).where(eq(sites.id, id)).returning();
    return result.length > 0;
  }

  /**
   * 更新站点信息
   */
  async update(id: string, input: Partial<Omit<Site, "id" | "createdAt" | "requestedAt">>): Promise<Site | null> {
    const updatedData = {
      ...input,
      updatedAt: new Date().toISOString(),
    };

    const result = await db
      .update(sites)
      .set(updatedData)
      .where(eq(sites.id, id))
      .returning();

    return result[0] || null;
  }
}

export const siteManager = new SiteManager();