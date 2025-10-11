import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/turso-client";
import { sites, type Site, type NewSite } from "../db/schema";
import { randomId } from "../random-id";

/**
 * 站点管理器
 * 管理Saleor站点的授权和访问控制
 */
export class SiteManager {
  /**
   * 注册新站点（当站点安装插件时自动调用）
   */
  async register(input: Omit<NewSite, "id" | "createdAt" | "updatedAt" | "requestedAt">): Promise<Site> {
    const now = new Date().toISOString();
    const site: NewSite = {
      id: randomId(),
      ...input,
      status: "pending", // 默认待审批
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(sites).values(site);
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
   * 检查站点是否被授权访问
   */
  async isAuthorized(domain: string): Promise<boolean> {
    const site = await this.getByDomain(domain);
    return site?.status === "approved";
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