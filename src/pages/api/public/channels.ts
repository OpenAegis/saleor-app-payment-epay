import { type NextApiRequest, type NextApiResponse } from "next";
import { channelManager } from "../../../lib/managers/channel-manager";
import { createLogger } from "../../../lib/logger";

const logger = createLogger({ component: "PublicChannelsAPI" });

/**
 * 公开API - 获取启用的支付通道列表
 * 无需认证，供Saleor应用前端显示
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    logger.info("获取启用的支付通道列表");

    // 获取所有启用的支付通道
    const channels = await channelManager.getEnabled();

    logger.info(`找到 ${channels.length} 个启用的支付通道`);

    return res.status(200).json({ channels });
  } catch (error) {
    logger.error(
      "获取支付通道列表时出错: " + (error instanceof Error ? error.message : "未知错误"),
    );
    return res.status(500).json({ error: "Internal server error" });
  }
}
