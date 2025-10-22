import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

/**
 * 支付渠道表
 * 渠道是具体的易支付配置，包含易支付API地址、商户ID、密钥等
 */
export const gateways = sqliteTable("gateways", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // 渠道名称，如"易支付主渠道"、"易支付备用渠道"
  description: text("description"),
  epayUrl: text("epay_url").notNull(), // 易支付API地址
  epayPid: text("epay_pid").notNull(), // 易支付商户ID
  epayKey: text("epay_key").notNull(), // 易支付密钥 (MD5签名使用)
  epayRsaPrivateKey: text("epay_rsa_private_key"), // RSA私钥 (RSA签名使用)
  
  // API 版本配置
  apiVersion: text("api_version").notNull().default("v1"), // v1 或 v2
  signType: text("sign_type").notNull().default("MD5"), // MD5 或 RSA
  
  icon: text("icon"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  priority: integer("priority").notNull().default(0),

  // 访问控制字段
  isMandatory: integer("is_mandatory", { mode: "boolean" }).notNull().default(false), // 是否为强制渠道
  allowedUsers: text("allowed_users").notNull().default("[]"), // JSON数组，白名单用户列表
  isGlobal: integer("is_global", { mode: "boolean" }).notNull().default(true), // 是否为全局渠道

  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * 支付通道表
 * 通道是支付方式的分类，如"支付宝通道"、"微信通道"等，使用指定的渠道进行支付
 */
export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(),
  gatewayId: text("gateway_id")
    .notNull()
    .references(() => gateways.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // 通道名称，如"支付宝通道"
  description: text("description"),
  type: text("type").notNull(), // 支付类型：alipay, wxpay, qqpay, bank, jdpay, paypal 或自定义类型
  icon: text("icon"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * 站点授权和认证数据表（合并表）
 * 管理Saleor站点的授权状态和认证数据
 */
export const sites = sqliteTable("sites", {
  id: text("id").primaryKey(),
  
  // 站点基本信息
  domain: text("domain").notNull().unique(), // 站点域名，如 shop.example.com
  name: text("name").notNull(), // 站点名称
  saleorApiUrl: text("saleor_api_url").notNull(), // Saleor API地址（也是认证数据的主键）
  clientIP: text("client_ip"), // 客户端真实IP地址
  
  // 认证数据字段
  token: text("token"), // Saleor认证token
  appId: text("app_id"), // Saleor App ID
  jwks: text("jwks"), // JWKS数据（JSON字符串）
  
  // 授权管理字段
  status: text("status").notNull().default("pending"), // pending, approved, rejected, suspended
  requestedAt: text("requested_at")
    .notNull()
    .default(sql`(datetime('now'))`), // 请求安装时间
  approvedAt: text("approved_at"), // 审批时间
  approvedBy: text("approved_by"), // 审批人（插件管理员）
  notes: text("notes"), // 备注
  lastActiveAt: text("last_active_at"), // 最后活跃时间
  
  // 时间戳
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * 域名白名单表
 * 管理允许安装此支付插件的域名
 */
export const domainWhitelist = sqliteTable("domain_whitelist", {
  id: text("id").primaryKey(),
  domainPattern: text("domain_pattern").notNull().unique(), // 域名模式，支持正则表达式
  description: text("description"), // 描述
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true), // 是否激活
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * 订单映射表
 * 存储订单号哈希值和 Saleor transaction ID 的映射关系
 */
export const orderMappings = sqliteTable("order_mappings", {
  id: text("id").primaryKey(),
  orderNo: text("order_no").notNull().unique(), // 完整的订单号
  orderHash: text("order_hash").notNull().unique(), // 订单号中的哈希部分 (8位)
  transactionId: text("transaction_id").notNull(), // Saleor transaction ID
  saleorApiUrl: text("saleor_api_url").notNull(), // 关联的 Saleor API URL
  status: text("status").notNull().default("pending"), // pending, paid, failed
  
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// 类型定义
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;

export type OrderMapping = typeof orderMappings.$inferSelect;
export type NewOrderMapping = typeof orderMappings.$inferInsert;
export type Gateway = typeof gateways.$inferSelect;
export type NewGateway = typeof gateways.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type DomainWhitelist = typeof domainWhitelist.$inferSelect;
export type NewDomainWhitelist = typeof domainWhitelist.$inferInsert;

// 索引定义
export const channelIndexes = {
  gatewayIdIndex: unique("channel_gateway_idx").on(channels.gatewayId),
};
