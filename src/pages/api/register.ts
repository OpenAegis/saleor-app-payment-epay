import { type NextApiRequest, type NextApiResponse } from "next";
import { type AuthData } from "@saleor/app-sdk/APL";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";

const logger = createLogger({ component: "RegisterAPI" });

/**
 * 修正Saleor API URL
 * 如果URL是localhost，使用占位符URL
 */
function correctSaleorApiUrl(saleorApiUrl: string, _saleorDomain: string | undefined): string {
  try {
    // 检查是否为localhost URL
    const url = new URL(saleorApiUrl);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      logger.info("检测到localhost URL: " + saleorApiUrl + ", 使用占位符URL");

      // 使用占位符URL，稍后在应用设置中手动配置
      const placeholderUrl = "https://your-saleor-instance.com/graphql/";
      logger.info("使用占位符URL: " + placeholderUrl);
      return placeholderUrl;
    }
  } catch (error) {
    logger.error(
      "解析URL时出错: " +
        saleorApiUrl +
        ", 错误: " +
        (error instanceof Error ? error.message : "未知错误"),
    );
  }

  // 如果不是localhost，返回原始URL
  return saleorApiUrl;
}

/**
 * 获取App ID
 */
async function getAppId(saleorApiUrl: string, token: string): Promise<string | undefined> {
  try {
    const response = await fetch(saleorApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `
        {
          app{
            id
          }
        }
        `,
      }),
    });

    if (response.status !== 200) {
      logger.error(`Could not get the app ID: Saleor API has response code ${response.status}`);
      return undefined;
    }

    const body: unknown = await response.json();
    if (body && typeof body === "object" && "data" in body) {
      const data = body.data;
      if (data && typeof data === "object" && "app" in data) {
        const app = data.app;
        if (app && typeof app === "object" && "id" in app) {
          return app.id as string;
        }
      }
    }
    return undefined;
  } catch (error) {
    logger.error(
      "Could not get the app ID: " + (error instanceof Error ? error.message : "未知错误"),
    );
    return undefined;
  }
}

/**
 * 获取JWKS
 */
async function fetchRemoteJwks(saleorApiUrl: string): Promise<string | undefined> {
  try {
    const jwksUrl = saleorApiUrl.replace("/graphql/", "/.well-known/jwks.json");
    const response = await fetch(jwksUrl);
    const jwksText = await response.text();
    return jwksText;
  } catch (error) {
    logger.error(
      "Could not fetch the remote JWKS: " + (error instanceof Error ? error.message : "未知错误"),
    );
    return undefined;
  }
}

/**
 * Required endpoint, called by Saleor to install app.
 * It will exchange tokens with app, so saleorApp.apl will contain token
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body: unknown = req.body;
    let authToken: string | undefined;
    if (body && typeof body === "object" && body !== null && "auth_token" in body) {
      authToken = body.auth_token as string;
    }

    const saleorDomain = req.headers["saleor-domain"];
    const saleorApiUrl = req.headers["saleor-api-url"] as string;

    logger.info("Register请求开始");
    logger.info("请求方法: " + req.method);
    logger.info("请求URL: " + req.url);
    logger.info("请求头信息: " + JSON.stringify(req.headers));
    logger.info("请求参数: " + JSON.stringify(req.body));

    if (!saleorApiUrl) {
      logger.error("saleorApiUrl不存在于请求头中");
      return res.status(400).json({ error: "Missing saleor-api-url header" });
    }

    if (!authToken) {
      logger.error("authToken不存在于请求体中");
      return res.status(400).json({ error: "Missing auth_token" });
    }

    // 修正saleorApiUrl
    const correctedUrl = correctSaleorApiUrl(saleorApiUrl, saleorDomain as string | undefined);
    logger.info("修正saleorApiUrl: " + saleorApiUrl + " -> " + correctedUrl);

    // 尝试获取App ID（使用修正后的URL）
    let appId = await getAppId(correctedUrl, authToken);
    if (!appId) {
      logger.warn(`无法获取App ID，使用默认ID。Saleor URL: ${correctedUrl}`);
      // 使用默认ID，确保安装可以继续进行
      appId = "app-placeholder-id";
    }

    // 尝试获取JWKS（使用修正后的URL）
    let jwks = await fetchRemoteJwks(correctedUrl);
    if (!jwks) {
      logger.warn("无法获取JWKS，使用默认JWKS");
      // 使用默认JWKS，确保安装可以继续进行
      jwks = "{}";
    }

    // 构建authData（使用修正后的URL）
    const authData: AuthData = {
      domain: saleorDomain as string | undefined,
      token: authToken,
      saleorApiUrl: correctedUrl, // 使用修正后的URL
      appId,
      jwks,
    };

    logger.info("准备保存authData: " + JSON.stringify(authData));

    // 检查APL是否已配置
    try {
      const aplConfigured = await saleorApp.apl.isConfigured();
      logger.info("APL配置状态: " + JSON.stringify(aplConfigured));

      if (!aplConfigured.configured) {
        logger.error("APL未正确配置: " + (aplConfigured.error?.message || "未知错误"));
        return res.status(503).json({
          success: false,
          error: {
            message: "APL not configured: " + (aplConfigured.error?.message || "未知错误"),
          },
        });
      }
    } catch (configError) {
      logger.error(
        "检查APL配置时出错: " + (configError instanceof Error ? configError.message : "未知错误"),
      );
      return res.status(503).json({
        success: false,
        error: {
          message:
            "Error checking APL configuration: " +
            (configError instanceof Error ? configError.message : "未知错误"),
        },
      });
    }

    // 保存到APL
    try {
      await saleorApp.apl.set(authData);
      logger.info("AuthData保存成功");
    } catch (saveError) {
      logger.error(
        "保存AuthData时出错: " + (saveError instanceof Error ? saveError.message : "未知错误"),
      );
      logger.error("保存失败的authData: " + JSON.stringify(authData));
      return res.status(500).json({
        success: false,
        error: {
          message:
            "Could not save auth data: " +
            (saveError instanceof Error ? saveError.message : "未知错误"),
        },
      });
    }

    logger.info("Register完成");
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error("Registration failed: " + (error instanceof Error ? error.message : "未知错误"));
    return res.status(500).json({
      success: false,
      error: {
        message: "Registration failed: " + (error instanceof Error ? error.message : "未知错误"),
      },
    });
  }
}
