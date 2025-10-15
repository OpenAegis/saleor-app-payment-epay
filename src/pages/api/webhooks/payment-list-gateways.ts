import { type NextApiRequest, type NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 根据Saleor文档，PAYMENT_GATEWAY_INITIALIZE_SESSION webhook应该返回一个包含data字段的对象
  // 这个data字段会被直接返回给storefront
  const response = {
    data: {
      // 返回支付方法列表，符合Saleor新API的要求
      paymentMethodsResponse: {
        paymentMethods: [
          {
            id: "epay",
            name: "彩虹易支付",
            currencies: ["CNY"],
            config: [],
          },
        ]
      },
      // 可以添加其他需要的配置信息
      clientKey: "epay-client-key",
      environment: "LIVE",
    },
  };

  return res.status(200).json(response);
}

// 禁用bodyParser，以便Saleor可以正确验证签名
export const config = {
  api: {
    bodyParser: false,
  },
};