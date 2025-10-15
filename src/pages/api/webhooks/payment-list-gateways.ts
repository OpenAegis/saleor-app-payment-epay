import { type NextApiRequest, type NextApiResponse } from "next";
import { gatewayManager } from "../../../lib/managers/gateway-manager";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 获取所有启用的支付通道
    const enabledGateways = await gatewayManager.getEnabled();
    
    // 将数据库中的支付通道转换为Saleor期望的格式
    const paymentMethods = enabledGateways.map(gateway => ({
      id: gateway.id,
      name: gateway.name,
      currencies: ["CNY"], // 默认使用CNY货币
      config: [], // Saleor应用不直接暴露配置信息
    }));

    // 根据Saleor文档，PAYMENT_GATEWAY_INITIALIZE_SESSION webhook应该返回一个包含data字段的对象
    // 这个data字段会被直接返回给storefront
    const response = {
      data: {
        // 返回支付方法列表，符合Saleor新API的要求
        paymentMethodsResponse: {
          paymentMethods,
        },
        // 可以添加其他需要的配置信息
        clientKey: "epay-client-key",
        environment: "LIVE",
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("获取支付通道时出错:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// 禁用bodyParser，以便Saleor可以正确验证签名
export const config = {
  api: {
    bodyParser: false,
  },
};