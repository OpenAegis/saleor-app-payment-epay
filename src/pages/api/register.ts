import { type NextApiRequest, type NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";
import { env } from "../../../src/lib/env.mjs";

const logger = createLogger({ component: "RegisterAPI" });

/**
 * 修正Saleor API URL
 * 如果URL是localhost，使用环境变量或占位符
 */
function correctSaleorApiUrl(saleorApiUrl: string, _saleorDomain: string | undefined): string {
  try {
    // 检查是否为localhost URL
    const url = new URL(saleorApiUrl);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      logger.info("检测到localhost URL: " + saleorApiUrl + ", 使用占位符URL");

      // 首先尝试使用环境变量中的APP_URL
      if (env.APP_URL) {
        try {
          const appUrl = new URL(env.APP_URL);
          // 从APP_URL构建Saleor API URL（假设Saleor API在相同域名下）
          const correctedUrl = appUrl.origin + "/graphql/";
          logger.info("使用环境变量APP_URL构建URL: " + correctedUrl);
          return correctedUrl;
        } catch (error) {
          logger.warn(
            "无法从环境变量APP_URL构建URL: " +
              env.APP_URL +
              ", 错误: " +
              (error instanceof Error ? error.message : "未知错误"),
          );
        }
      }

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
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        query: `
        {
          app{
            id
          }
        }
        `
      })
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
    logger.error("Could not get the app ID: " + (error instanceof Error ? error.message : "未知错误"));
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
    logger.error("Could not fetch the remote JWKS: " + (error instanceof Error ? error.message : "未知错误"));
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

    // 获取App ID（使用修正后的URL）
    const appId = await getAppId(correctedUrl, authToken);
    if (!appId) {
      logger.error(`The auth data given during registration request could not be used to fetch app ID. This usually means that App could not connect to Saleor during installation. Saleor URL that App tried to connect: ${correctedUrl}`);
      return res.status(401).json({ 
        success: false,
        error: {
          code: "UNKNOWN_APP_ID",
          message: `The auth data given during registration request could not be used to fetch app ID. This usually means that App could not connect to Saleor during installation. Saleor URL that App tried to connect: ${correctedUrl}`
        }
      });
    }

    // 获取JWKS（使用修正后的URL）
    const jwks = await fetchRemoteJwks(correctedUrl);
    if (!jwks) {
      logger.error("Can't fetch the remote JWKS");
      return res.status(401).json({
        success: false,
        error: {
          code: "JWKS_NOT_AVAILABLE",
          message: "Can't fetch the remote JWKS."
        }
      });
    }

    // 构建authData（使用原始URL，因为这是Saleor传递给我们的）
    const authData = {
      domain: saleorDomain as string | undefined,
      token: authToken,
      saleorApiUrl: correctedUrl, // 使用修正后的URL
      appId,
      jwks
    };

    logger.info("authData: " + JSON.stringify(authData));

    // 保存到APL
    await saleorApp.apl.set(authData);

    logger.info("Register完成");
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error("Registration failed: " + (error instanceof Error ? error.message : "未知错误"));
    return res.status(500).json({ 
      success: false,
      error: {
        message: "Registration failed: could not save the auth data."
      }
    });
  }
}