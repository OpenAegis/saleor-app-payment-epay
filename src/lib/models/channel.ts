import { z } from "zod";

/**
 * 渠道（Channel）- 支付方式的分组，如支付宝渠道、微信渠道等
 */
export const ChannelSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "渠道名称不能为空"),
  description: z.string().optional(),
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