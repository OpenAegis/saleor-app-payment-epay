import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

/**
 * 支付渠道表
 * 渠道是支付方式的分组，如"支付宝渠道"、"微信渠道"等
 */
export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * 支付通道表  
 * 通道是具体的支付配置，如"支付宝1"、"支付宝2"等
 */
export const gateways = sqliteTable("gateways", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 支付类型：alipay, wxpay, qqpay, bank, jdpay, paypal, 或自定义
  icon: text("icon"),
  pid: text("pid").notNull(), // 商户ID
  key: text("key").notNull(), // 商户密钥
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  priority: integer("priority").notNull().default(0),
  
  // 访问控制字段
  isMandatory: integer("is_mandatory", { mode: "boolean" }).notNull().default(false), // 是否为强制通道
  allowedUsers: text("allowed_users").notNull().default("[]"), // JSON数组，白名单用户列表
  isGlobal: integer("is_global", { mode: "boolean" }).notNull().default(true), // 是否为全局通道
  
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// 类型定义
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type Gateway = typeof gateways.$inferSelect;
export type NewGateway = typeof gateways.$inferInsert;

// 索引定义
export const gatewayIndexes = {
  channelIdIndex: unique("gateway_channel_idx").on(gateways.channelId),
  typeIndex: unique("gateway_type_idx").on(gateways.type),
};