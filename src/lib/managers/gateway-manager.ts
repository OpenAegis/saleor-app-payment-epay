import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { db } from "../db/turso-client";
import { gateways, channels, type Gateway, type NewGateway } from "../db/schema";
import { randomId } from "../random-id";
import type { CreateGatewayAPIInput, UpdateGatewayAPIInput } from "../models/gateway";

/**
 * 网关管理器
 * 管理支付通道的增删改查操作
 */
export class GatewayManager {
  /**
   * 创建新通道
   */
  async create(input: CreateGatewayAPIInput): Promise<Gateway> {
    const now = new Date().toISOString();
    const gateway: NewGateway = {
      id: randomId(),
      name: input.name,
      description: input.description,
      epayUrl: input.epayUrl,
      epayPid: input.epayPid,
      epayKey: input.epayKey,
      epayRsaPrivateKey: input.epayRsaPrivateKey || null,
      apiVersion: input.apiVersion || "v1",
      signType: input.signType || "MD5",
      icon: input.icon,
      enabled: input.enabled ?? true,
      priority: input.priority || 0,
      isMandatory: input.isMandatory || false,
      isGlobal: input.isGlobal ?? true,
      // 确保allowedUsers是JSON字符串
      allowedUsers: Array.isArray(input.allowedUsers) 
        ? JSON.stringify(input.allowedUsers)
        : JSON.stringify(input.allowedUsers || []),
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
   * 获取被指定通道使用的渠道
   */
  async getUsedByChannels(): Promise<Gateway[]> {
    // 获取被通道使用的渠道ID
    const usedGatewayIds = await db
      .selectDistinct({ gatewayId: channels.gatewayId })
      .from(channels);
    
    if (usedGatewayIds.length === 0) {
      return [];
    }
    
    const gatewayIds = usedGatewayIds.map(c => c.gatewayId);
    const result = await db
      .select()
      .from(gateways)
      .where(inArray(gateways.id, gatewayIds))
      .orderBy(desc(gateways.priority), asc(gateways.createdAt));
    
    // 解析allowedUsers JSON
    return result.map(gateway => ({
      ...gateway,
      allowedUsers: JSON.parse(gateway.allowedUsers),
    })) as Gateway[];
  }

  /**
   * 获取启用的渠道
   */
  async getEnabled(): Promise<Gateway[]> {
    const result = await db
      .select()
      .from(gateways)
      .where(eq(gateways.enabled, true))
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
  async update(id: string, input: UpdateGatewayAPIInput): Promise<Gateway | null> {
    const updateData: any = {
      ...input,
      updatedAt: new Date().toISOString(),
    };

    // 如果更新allowedUsers，确保是JSON字符串
    if (input.allowedUsers !== undefined) {
      updateData.allowedUsers = JSON.stringify(input.allowedUsers);
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
   * 按支付类型获取渠道（通过通道类型查找使用的渠道）
   */
  async getByType(type: string): Promise<Gateway[]> {
    // 首先获取指定类型的通道
    const channelResults = await db
      .select({ gatewayId: channels.gatewayId })
      .from(channels)
      .where(eq(channels.type, type));
    
    if (channelResults.length === 0) {
      return [];
    }
    
    // 获取这些通道使用的渠道
    const gatewayIds = channelResults.map(c => c.gatewayId);
    const result = await db
      .select()
      .from(gateways)
      .where(inArray(gateways.id, gatewayIds))
      .orderBy(desc(gateways.priority), asc(gateways.createdAt));
    
    // 解析allowedUsers JSON
    return result.map(gateway => ({
      ...gateway,
      allowedUsers: JSON.parse(gateway.allowedUsers),
    })) as Gateway[];
  }
}

export const gatewayManager = new GatewayManager();