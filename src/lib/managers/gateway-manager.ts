import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "../db/turso-client";
import { gateways, type Gateway, type NewGateway } from "../db/schema";
import { randomId } from "../random-id";

/**
 * 网关管理器
 * 管理支付通道的增删改查操作
 */
export class GatewayManager {
  /**
   * 创建新通道
   */
  async create(input: Omit<NewGateway, "id" | "createdAt" | "updatedAt">): Promise<Gateway> {
    const now = new Date().toISOString();
    const gateway: NewGateway = {
      id: randomId(),
      ...input,
      // 确保allowedUsers是JSON字符串
      allowedUsers: Array.isArray(input.allowedUsers) 
        ? JSON.stringify(input.allowedUsers)
        : input.allowedUsers || "[]",
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(gateways).values(gateway);
    
    // 返回时解析allowedUsers
    return {
      ...gateway,
      allowedUsers: JSON.parse(gateway.allowedUsers as string),
    } as Gateway;
  }

  /**
   * 获取单个通道
   */
  async get(id: string): Promise<Gateway | null> {
    const result = await db.select().from(gateways).where(eq(gateways.id, id)).limit(1);
    const gateway = result[0];
    
    if (!gateway) return null;

    // 解析allowedUsers JSON
    return {
      ...gateway,
      allowedUsers: JSON.parse(gateway.allowedUsers),
    } as Gateway;
  }

  /**
   * 获取所有通道
   */
  async getAll(): Promise<Gateway[]> {
    const result = await db
      .select()
      .from(gateways)
      .orderBy(desc(gateways.priority), asc(gateways.createdAt));
    
    // 解析allowedUsers JSON
    return result.map(gateway => ({
      ...gateway,
      allowedUsers: JSON.parse(gateway.allowedUsers),
    })) as Gateway[];
  }

  /**
   * 获取指定渠道的所有通道
   */
  async getByChannel(channelId: string): Promise<Gateway[]> {
    const result = await db
      .select()
      .from(gateways)
      .where(eq(gateways.channelId, channelId))
      .orderBy(desc(gateways.priority), asc(gateways.createdAt));
    
    // 解析allowedUsers JSON
    return result.map(gateway => ({
      ...gateway,
      allowedUsers: JSON.parse(gateway.allowedUsers),
    })) as Gateway[];
  }

  /**
   * 获取启用的通道
   */
  async getEnabled(channelId?: string): Promise<Gateway[]> {
    const conditions = [eq(gateways.enabled, true)];
    if (channelId) {
      conditions.push(eq(gateways.channelId, channelId));
    }

    const result = await db
      .select()
      .from(gateways)
      .where(and(...conditions))
      .orderBy(desc(gateways.priority), asc(gateways.createdAt));
    
    // 解析allowedUsers JSON
    return result.map(gateway => ({
      ...gateway,
      allowedUsers: JSON.parse(gateway.allowedUsers),
    })) as Gateway[];
  }

  /**
   * 获取用户可访问的通道
   */
  async getAccessibleGateways(userIdentifier: string | null, isAdmin: boolean = false): Promise<Gateway[]> {
    const all = await this.getAll();
    
    if (isAdmin) {
      return all;
    }

    return all.filter((gateway) => {
      // 全局通道
      if (gateway.isGlobal) {
        return true;
      }

      // 检查白名单
      if (gateway.allowedUsers && gateway.allowedUsers.length > 0) {
        return userIdentifier && gateway.allowedUsers.includes(userIdentifier);
      }

      return false;
    });
  }

  /**
   * 更新通道
   */
  async update(id: string, input: Partial<Omit<Gateway, "id" | "createdAt" | "updatedAt">>): Promise<Gateway | null> {
    const updateData = {
      ...input,
      updatedAt: new Date().toISOString(),
    };

    // 如果更新allowedUsers，确保是JSON字符串
    if (input.allowedUsers) {
      updateData.allowedUsers = Array.isArray(input.allowedUsers)
        ? JSON.stringify(input.allowedUsers)
        : input.allowedUsers;
    }

    const result = await db
      .update(gateways)
      .set(updateData)
      .where(eq(gateways.id, id))
      .returning();

    const gateway = result[0];
    if (!gateway) return null;

    // 解析allowedUsers JSON
    return {
      ...gateway,
      allowedUsers: JSON.parse(gateway.allowedUsers),
    } as Gateway;
  }

  /**
   * 删除通道
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(gateways).where(eq(gateways.id, id)).returning();
    return result.length > 0;
  }

  /**
   * 删除渠道下的所有通道
   */
  async deleteByChannel(channelId: string): Promise<number> {
    const result = await db
      .delete(gateways)
      .where(eq(gateways.channelId, channelId))
      .returning();
    
    return result.length;
  }

  /**
   * 切换通道启用状态
   */
  async toggleEnabled(id: string): Promise<Gateway | null> {
    const existing = await this.get(id);
    if (!existing) {
      return null;
    }

    return this.update(id, { enabled: !existing.enabled });
  }

  /**
   * 检查通道是否存在
   */
  async exists(id: string): Promise<boolean> {
    const gateway = await this.get(id);
    return gateway !== null;
  }

  /**
   * 按类型获取通道
   */
  async getByType(type: string): Promise<Gateway[]> {
    const result = await db
      .select()
      .from(gateways)
      .where(eq(gateways.type, type))
      .orderBy(desc(gateways.priority), asc(gateways.createdAt));
    
    // 解析allowedUsers JSON
    return result.map(gateway => ({
      ...gateway,
      allowedUsers: JSON.parse(gateway.allowedUsers),
    })) as Gateway[];
  }
}

export const gatewayManager = new GatewayManager();