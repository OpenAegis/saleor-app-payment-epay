import { z } from "zod";

/**
 * 渠道（Gateway）- 具体的易支付配置
 */
export const GatewaySchema = z.object({
  id: z.string(),
  name: z.string().min(1, "渠道名称不能为空"),
  description: z.string().optional(),
  epayUrl: z.string().url("易支付API地址必须是有效的URL").min(1, "易支付API地址不能为空"), // 易支付API地址
  epayPid: z.string().min(1, "易支付商户ID不能为空"), // 易支付商户ID
  epayKey: z.string().min(1, "易支付密钥不能为空"), // 易支付密钥 (MD5签名使用)
  epayRsaPrivateKey: z.string().optional(), // RSA私钥 (RSA签名使用)
  
  // API 版本配置
  apiVersion: z.enum(["v1", "v2"]).default("v1"), // API 版本
  signType: z.enum(["MD5", "RSA"]).default("MD5"), // 签名类型
  
  icon: z.string().optional(), // 图标URL
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).default(0), // 优先级，数字越大优先级越高

  // 访问控制字段
  isMandatory: z.boolean().default(false), // 是否为强制渠道（用户不能禁用）
  allowedUsers: z.array(z.string()).default([]), // 白名单用户列表（空数组表示所有用户都可用）
  isGlobal: z.boolean().default(true), // 是否为全局渠道（所有用户可见）

  createdAt: z.string(),
  updatedAt: z.string(),
}).refine((data) => {
  // v1 API 必须使用 MD5 签名
  if (data.apiVersion === "v1" && data.signType !== "MD5") {
    return false;
  }
  // v2 API 必须使用 RSA 签名
  if (data.apiVersion === "v2" && data.signType !== "RSA") {
    return false;
  }
  // RSA 签名时必须提供 RSA 私钥
  if (data.signType === "RSA" && !data.epayRsaPrivateKey?.trim()) {
    return false;
  }
  return true;
}, {
  message: "API 版本与签名类型不匹配，或 RSA 签名缺少私钥",
});

export type Gateway = z.infer<typeof GatewaySchema>;

export const CreateGatewaySchema = GatewaySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateGatewayInput = z.infer<typeof CreateGatewaySchema>;

// 用于API的创建接口类型，allowedUsers是字符串数组
export type CreateGatewayAPIInput = Omit<CreateGatewayInput, 'allowedUsers'> & {
  allowedUsers: string[];
};

export const UpdateGatewaySchema = GatewaySchema.partial().omit({
  id: true,
  createdAt: true,
});

export type UpdateGatewayInput = z.infer<typeof UpdateGatewaySchema>;

// 用于API的更新接口类型，allowedUsers是字符串数组
export type UpdateGatewayAPIInput = Omit<UpdateGatewayInput, 'allowedUsers'> & {
  allowedUsers?: string[];
};

// 用户只能修改的字段（仅启用/禁用）
export const UserUpdateGatewaySchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
});

export type UserUpdateGatewayInput = z.infer<typeof UserUpdateGatewaySchema>;

// 预设的支付类型（系统内置的6种支付方式）
export const PresetPaymentTypes = [
  { value: "alipay", label: "支付宝" },
  { value: "wxpay", label: "微信支付" },
  { value: "qqpay", label: "QQ钱包" },
  { value: "bank", label: "云闪付" },
  { value: "jdpay", label: "京东支付" },
  { value: "paypal", label: "PayPal" },
] as const;

// 支付类型的中文名称映射（包含预设类型）
export const PaymentTypeNames: Record<string, string> = {
  alipay: "支付宝",
  wxpay: "微信支付",
  qqpay: "QQ钱包",
  bank: "云闪付",
  jdpay: "京东支付",
  paypal: "PayPal",
};

// 获取支付类型的显示名称（如果是预设类型返回中文名，否则返回原值）
export function getPaymentTypeName(type: string): string {
  return PaymentTypeNames[type] || type;
}