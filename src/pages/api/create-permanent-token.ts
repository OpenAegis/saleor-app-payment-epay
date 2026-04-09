import { createProtectedHandler } from "@saleor/app-sdk/handlers/next";
import { type NextApiRequest, type NextApiResponse } from "next";
import { createLogger } from "../../lib/logger";
import { fetchCurrentAppId } from "../../lib/saleor-app-token";
import { saleorApp } from "../../saleor-app";

const logger = createLogger({ component: "CreatePermanentTokenAPI" });

interface SavePermanentTokenBody {
  permanentToken?: string;
  appId?: string;
}

export default createProtectedHandler(
  async (req: NextApiRequest, res: NextApiResponse, { authData }) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { saleorApiUrl, token } = authData;

    if (!saleorApiUrl || !token) {
      return res.status(400).json({ error: "Missing authentication data" });
    }

    try {
      const body =
        typeof req.body === "string"
          ? (JSON.parse(req.body) as SavePermanentTokenBody)
          : (req.body as SavePermanentTokenBody);
      const permanentToken = body?.permanentToken?.trim();

      if (!permanentToken) {
        return res.status(400).json({ error: "Missing permanentToken" });
      }

      const resolvedAppId = await fetchCurrentAppId(saleorApiUrl, permanentToken);

      if (!resolvedAppId) {
        return res.status(400).json({ error: "永久 Token 验证失败，无法获取当前 App ID" });
      }

      const currentAppId = authData.appId || body?.appId;

      if (currentAppId && currentAppId !== resolvedAppId) {
        return res.status(400).json({ error: "永久 Token 与当前 App 不匹配" });
      }

      await saleorApp.apl.set({
        ...authData,
        saleorApiUrl,
        token: permanentToken,
        appId: resolvedAppId,
      });

      logger.info(
        {
          saleorApiUrl,
          appId: resolvedAppId,
        },
        "已保存前端生成的永久 App Token",
      );

      return res.status(200).json({
        success: true,
        message: "永久 Token 已保存，后续回调会使用新 Token",
      });
    } catch (error) {
      logger.error(
        {
          saleorApiUrl,
          error: error instanceof Error ? error.message : "未知错误",
        },
        "保存永久 Token 失败",
      );

      return res.status(500).json({
        error: error instanceof Error ? error.message : "保存永久 Token 失败",
      });
    }
  },
  saleorApp.apl,
);
