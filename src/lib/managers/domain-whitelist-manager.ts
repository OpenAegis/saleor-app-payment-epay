import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/turso-client";
import { domainWhitelist, type DomainWhitelist, type NewDomainWhitelist } from "../db/schema";
import { randomId } from "../random-id";
import { createLogger } from "../logger";

const logger = createLogger({ component: "DomainWhitelistManager" });

/**
 * 域名白名单管理器
 * 管理允许安装此支付插件的域名白名单
 */
export class DomainWhitelistManager {
  /**
   * 添加域名到白名单
   */
  async add(
    input: Omit<NewDomainWhitelist, "id" | "createdAt" | "updatedAt">,
  ): Promise<DomainWhitelist> {
    logger.info({ domainPattern: input.domainPattern }, "添加域名到白名单");

    // 检查是否已经存在相同的域名模式
    const existing = await this.getByPattern(input.domainPattern);
    if (existing) {
      logger.warn({ domainPattern: input.domainPattern }, "域名模式已存在");
      throw new Error("该域名模式已经存在于白名单中");
    }

    const now = new Date().toISOString();
    const record: NewDomainWhitelist = {
      id: randomId(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(domainWhitelist).values(record);
    logger.info({ id: record.id, domainPattern: input.domainPattern }, "域名添加到白名单成功");

    return record as DomainWhitelist;
  }

  /**
   * 获取单个白名单记录
   */
  async get(id: string): Promise<DomainWhitelist | null> {
    const result = await db
      .select()
      .from(domainWhitelist)
      .where(eq(domainWhitelist.id, id))
      .limit(1);
    return result[0] || null;
  }

  /**
   * 通过域名模式获取白名单记录
   */
  async getByPattern(domainPattern: string): Promise<DomainWhitelist | null> {
    const result = await db
      .select()
      .from(domainWhitelist)
      .where(eq(domainWhitelist.domainPattern, domainPattern))
      .limit(1);
    return result[0] || null;
  }

  /**
   * 获取所有白名单记录
   */
  async getAll(): Promise<DomainWhitelist[]> {
    const result = await db.select().from(domainWhitelist).orderBy(desc(domainWhitelist.createdAt));

    return result;
  }

  /**
   * 获取激活的白名单记录
   */
  async getActive(): Promise<DomainWhitelist[]> {
    const result = await db
      .select()
      .from(domainWhitelist)
      .where(eq(domainWhitelist.isActive, true))
      .orderBy(desc(domainWhitelist.createdAt));

    return result;
  }

  /**
   * 更新白名单记录
   */
  async update(
    id: string,
    input: Partial<Omit<DomainWhitelist, "id" | "createdAt">>,
  ): Promise<DomainWhitelist | null> {
    const updatedData = {
      ...input,
      updatedAt: new Date().toISOString(),
    };

    const result = await db
      .update(domainWhitelist)
      .set(updatedData)
      .where(eq(domainWhitelist.id, id))
      .returning();

    return result[0] || null;
  }

  /**
   * 删除白名单记录
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(domainWhitelist).where(eq(domainWhitelist.id, id)).returning();
    return result.length > 0;
  }

  /**
   * 检查域名是否在白名单中
   */
  async isAllowed(domain: string): Promise<boolean> {
    // 获取所有激活的白名单记录
    const activePatterns = await this.getActive();

    // 如果没有激活的白名单记录，则允许所有域名
    if (activePatterns.length === 0) {
      logger.info({ domain }, "没有激活的白名单记录，允许所有域名");
      return true;
    }

    // 检查域名是否匹配任何白名单模式
    for (const pattern of activePatterns) {
      try {
        const regex = new RegExp(pattern.domainPattern);
        if (regex.test(domain)) {
          logger.info({ domain, pattern: pattern.domainPattern }, "域名匹配白名单模式");
          return true;
        }
      } catch (error) {
        logger.warn(
          {
            errorMessage: error instanceof Error ? error.message : "未知错误",
            domain,
            pattern: pattern.domainPattern,
          },
          "白名单模式正则表达式错误",
        );
        // 如果正则表达式有错误，跳过这个模式
        continue;
      }
    }

    logger.info({ domain }, "域名不在白名单中");
    return false;
  }
}

export const domainWhitelistManager = new DomainWhitelistManager();
