import { z } from "zod";

// 彩虹易支付配置模式
export const epayConfigSchema = z.object({
  pid: z.string().min(1, "商户ID不能为空"),
  key: z.string().min(1, "商户密钥不能为空"),
  apiUrl: z.string().url("API地址必须是有效的URL"),
  returnUrl: z.string().url("返回地址必须是有效的URL").optional(), // 添加返回地址字段
  enabled: z.boolean().default(true),
});

// 彩虹易支付配置条目模式（与PaymentAppConfigEntry兼容）
export const epayConfigEntrySchema = z.object({
  configurationId: z.string().min(1),
  configurationName: z.string().min(1, "配置名称不能为空"),
  // 保持与PaymentAppConfigEntry相同的字段结构
  apiKey: z.string().nullable().default(null), // 彩虹易支付不需要，但为了兼容性保留
  apiKeyId: z.string().nullable().default(null), // 彩虹易支付不需要，但为了兼容性保留
  clientKey: z.string().nullable().default(null), // 彩虹易支付不需要，但为了兼容性保留
  webhookPassword: z.string().nullable().default(null), // 彩虹易支付不需要，但为了兼容性保留
  // 彩虹易支付特定字段
  pid: z.string().min(1, "商户ID不能为空"),
  key: z.string().min(1, "商户密钥不能为空"),
  apiUrl: z.string().url("API地址必须是有效的URL"),
  returnUrl: z.string().url("返回地址必须是有效的URL").optional(), // 添加返回地址字段
  enabled: z.boolean().default(true),
});

export type EpayConfig = z.infer<typeof epayConfigSchema>;
export type EpayConfigEntry = z.infer<typeof epayConfigEntrySchema>;

// 彩虹易支付表单配置模式
export const epayFormConfigSchema = epayConfigSchema
  .extend({
    configurationName: z.string().min(1, "配置名称不能为空"),
  })
  .default({
    pid: "",
    key: "",
    apiUrl: "",
    returnUrl: "", // 添加默认值
    configurationName: "",
    enabled: true,
  });

export type EpayFormConfig = z.infer<typeof epayFormConfigSchema>;
