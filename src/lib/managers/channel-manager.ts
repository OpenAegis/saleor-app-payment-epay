import { eq, and } from "drizzle-orm";
import { db } from "../db/turso-client";
import { channels, gateways, type Channel, type NewChannel } from "../db/schema";
import { randomId } from "../random-id";

/**
 * 渠道管理器
 * 管理支付渠道的增删改查操作
 */
export class ChannelManager {
  /**
   * 创建新渠道
   */
  async create(input: Omit<NewChannel, "id" | "createdAt" | "updatedAt">): Promise<Channel> {
    const now = new Date().toISOString();
    const channel: NewChannel = {
      id: randomId(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(channels).values(channel);
    return channel as Channel;
  }

  /**
   * 获取单个渠道
   */
  async get(id: string): Promise<Channel | null> {
    const result = await db.select().from(channels).where(eq(channels.id, id)).limit(1);
    return result[0] || null;
  }

  /**
   * 获取所有渠道
   */
  async getAll(): Promise<Channel[]> {
    const result = await db
      .select()
      .from(channels)
      .orderBy(channels.priority, channels.createdAt);
    
    return result;
  }

  /**
   * 获取启用的渠道（同时检查关联的网关也必须启用）
   */
  async getEnabled(): Promise<Channel[]> {
    const result = await db
      .select({
        id: channels.id,
        gatewayId: channels.gatewayId,
        name: channels.name,
        description: channels.description,
        type: channels.type,
        icon: channels.icon,
        enabled: channels.enabled,
        priority: channels.priority,
        createdAt: channels.createdAt,
        updatedAt: channels.updatedAt,
      })
      .from(channels)
      .innerJoin(gateways, eq(channels.gatewayId, gateways.id))
      .where(
        and(
          eq(channels.enabled, true),
          eq(gateways.enabled, true)
        )
      )
      .orderBy(channels.priority, channels.createdAt);
    
    return result;
  }

  /**
   * 更新渠道
   */
  async update(id: string, input: Partial<Omit<Channel, "id" | "createdAt" | "updatedAt">>): Promise<Channel | null> {
    const updatedData = {
      ...input,
      updatedAt: new Date().toISOString(),
    };

    const result = await db
      .update(channels)
      .set(updatedData)
      .where(eq(channels.id, id))
      .returning();

    return result[0] || null;
  }

  /**
   * 删除渠道
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(channels).where(eq(channels.id, id)).returning();
    return result.length > 0;
  }

  /**
   * 切换渠道启用状态
   */
  async toggleEnabled(id: string): Promise<Channel | null> {
    const existing = await this.get(id);
    if (!existing) {
      return null;
    }

    return this.update(id, { enabled: !existing.enabled });
  }

  /**
   * 检查渠道是否存在
   */
  async exists(id: string): Promise<boolean> {
    const channel = await this.get(id);
    return channel !== null;
  }
}

export const channelManager = new ChannelManager();