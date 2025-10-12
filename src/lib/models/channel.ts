import { z } from "zod";

/**
 * 支付类型枚举
 */
export const PaymentTypeSchema = z.enum([
  "alipay",   // 支付宝
  "wxpay",    // 微信支付
  "qqpay",    // QQ钱包
  "bank",     // 云闪付
  "jdpay",    // 京东支付
  "paypal",   // PayPal
]);

/**
 * 通道（Channel）- 支付方式的分类，使用指定的渠道进行支付
 */
export const ChannelSchema = z.object({
  id: z.string(),
  gatewayId: z.string().min(1, "渠道ID不能为空"), // 使用的渠道ID
  name: z.string().min(1, "通道名称不能为空"),
  description: z.string().optional(),
  type: z.string().min(1, "支付类型不能为空"), // 支付类型：alipay, wxpay, qqpay, bank, jdpay, paypal 或自定义类型
  icon: z.string().optional(), // 图标URL
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).default(0), // 优先级，数字越大优先级越高
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Channel = z.infer<typeof ChannelSchema>;

export const CreateChannelSchema = ChannelSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateChannelInput = z.infer<typeof CreateChannelSchema>;

export const UpdateChannelSchema = ChannelSchema.partial().omit({
  id: true,
  createdAt: true,
});

export type UpdateChannelInput = z.infer<typeof UpdateChannelSchema>;