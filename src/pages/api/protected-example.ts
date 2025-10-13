import { createProtectedHandler } from "@saleor/app-sdk/handlers/next";
import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "ProtectedExampleAPI" });

/**
 * 这是一个受保护的API端点示例，演示如何使用基于令牌的鉴权机制
 */
export default createProtectedHandler(
  async (req: NextApiRequest, res: NextApiResponse, { authData }) => {
    const { saleorApiUrl, token } = authData;

    logger.info(
      "受保护的API端点被访问: " +
        JSON.stringify({
          saleorApiUrl,
          hasToken: !!token,
          method: req.method,
        }),
    );

    switch (req.method) {
      case "GET":
        try {
          // 这里可以执行需要鉴权的操作
          // 例如：获取Saleor数据、处理支付等

          return res.status(200).json({
            message: "受保护的资源访问成功",
            saleorApiUrl: saleorApiUrl,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          logger.error(
            "访问受保护资源时出错: " + (error instanceof Error ? error.message : "未知错误"),
          );
          return res.status(500).json({ error: "Internal server error" });
        }

      case "POST":
        try {
          // 处理POST请求
          const requestData: unknown = req.body;

          // 这里可以执行需要鉴权的操作
          // 例如：更新配置、处理订单等

          logger.info("处理POST请求: " + JSON.stringify({ requestData: "请求数据已接收" }));

          return res.status(200).json({
            message: "数据处理成功",
            requestData: requestData as Record<string, unknown>,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          logger.error(
            "处理POST请求时出错: " + (error instanceof Error ? error.message : "未知错误"),
          );
          return res.status(500).json({ error: "Internal server error" });
        }

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  },
  saleorApp.apl,
);
