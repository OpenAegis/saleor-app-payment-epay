import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

/**
 * 支付通道表
 * 通道是支付方式的分类，如"支付宝通道"、"微信通道"等
 */
export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // 通道名称，如"支付宝通道"
  description: text("description"),
  type: text("type").notNull(), // 支付类型：alipay, wxpay, qqpay, bank, jdpay, paypal
  icon: text("icon"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * 支付渠道表
 * 渠道是具体的易支付配置，包含易支付站点名称、密钥等
 */
export const gateways = sqliteTable("gateways", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // 渠道名称，如"易支付1"、"易支付2"
  description: text("description"),
  epayName: text("epay_name").notNull(), // 易支付站点名称
  epayKey: text("epay_key").notNull(), // 易支付密钥
  icon: text("icon"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  priority: integer("priority").notNull().default(0),
  
  // 访问控制字段
  isMandatory: integer("is_mandatory", { mode: "boolean" }).notNull().default(false), // 是否为强制渠道
  allowedUsers: text("allowed_users").notNull().default("[]"), // JSON数组，白名单用户列表
  isGlobal: integer("is_global", { mode: "boolean" }).notNull().default(true), // 是否为全局渠道
  
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * 站点授权表
 * 管理哪些Saleor站点被允许使用此支付插件
 */
export const sites = sqliteTable("sites", {
  id: text("id").primaryKey(),
  domain: text("domain").notNull().unique(), // 站点域名，如 shop.example.com
  name: text("name").notNull(), // 站点名称
  saleorApiUrl: text("saleor_api_url").notNull(), // Saleor API地址
  appId: text("app_id"), // Saleor App ID
  status: text("status").notNull().default("pending"), // pending, approved, rejected, suspended
  requestedAt: text("requested_at").notNull().default(sql`(datetime('now'))`), // 请求安装时间
  approvedAt: text("approved_at"), // 审批时间
  approvedBy: text("approved_by"), // 审批人（插件管理员）
  notes: text("notes"), // 备注
  lastActiveAt: text("last_active_at"), // 最后活跃时间
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// 类型定义
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type Gateway = typeof gateways.$inferSelect;
export type NewGateway = typeof gateways.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;

// 索引定义
export const gatewayIndexes = {
  channelIdIndex: unique("gateway_channel_idx").on(gateways.channelId),
};