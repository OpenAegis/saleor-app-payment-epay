import { type NextApiRequest, type NextApiResponse } from "next";
import { channelManager } from "../../../lib/managers/channel-manager";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("Payment gateway initialize webhook called");
  console.log("Request method:", req.method);
  console.log("Request headers:", req.headers);
  console.log("Request body:", req.body);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 获取所有启用的支付通道
    const enabledChannels = await channelManager.getEnabled();
    console.log("Enabled channels:", enabledChannels);

    // 将数据库中的支付通道转换为Saleor期望的格式
    // 每个通道都作为一个独立的支付方法返回
    const paymentMethods = enabledChannels.map((channel) => ({
      id: channel.id, // 使用通道ID作为支付方法ID
      name: channel.name, // 使用通道名称作为支付方法名称
      currencies: ["CNY"], // 默认使用CNY货币
      config: [], // Saleor应用不直接暴露配置信息
    }));

    console.log("Payment methods to return:", paymentMethods);

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

    console.log("Response to send:", JSON.stringify(response, null, 2));
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
