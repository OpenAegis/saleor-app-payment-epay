import type { NextApiRequest, NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";
import { siteManager } from "../../lib/managers/site-manager";
import { type ExtendedAuthData } from "../../lib/turso-apl";

const logger = createLogger({ component: "RegisterAPI" });

/**
 * 修正Saleor API URL
 * 保持原始URL，让自动检测机制在后续处理
 */
function correctSaleorApiUrl(saleorApiUrl: string, _saleorDomain: string | undefined): string {
  try {
    // 验证URL格式是否正确
    new URL(saleorApiUrl);
    logger.info("使用原始Saleor API URL: " + saleorApiUrl);
    return saleorApiUrl;
  } catch (error) {
    logger.error(
      "解析URL时出错: " +
        saleorApiUrl +
        ", 错误: " +
        (error instanceof Error ? error.message : "未知错误"),
    );

    // 如果URL格式错误，使用占位符URL
    const placeholderUrl = "https://your-saleor-instance.com/graphql/";
    logger.info("URL格式错误，使用占位符URL: " + placeholderUrl);
    return placeholderUrl;
  }
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

interface GraphQLErrorDetail {
  message?: string;
  extensions?: {
    exception?: {
      code?: string;
    };
  };
}

interface AppTokenCreateResponse {
  data?: {
    appTokenCreate?: {
      authToken?: string;
      errors?: Array<{ field?: string | null; message?: string | null; code?: string | null }>;
    };
  };
  errors?: GraphQLErrorDetail[];
}

async function createPermanentAppToken(
  saleorApiUrl: string,
  token: string,
  appId: string,
): Promise<string | null> {
  const mutation = `
    mutation AppTokenCreate($appId: ID!, $name: String!) {
      appTokenCreate(input: { app: $appId, name: $name }) {
        authToken
        errors {
          field
          message
          code
        }
      }
    }
  `;

  try {
    const response = await fetch(saleorApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          appId,
          name: `RainbowEpay-${new Date().toISOString()}`,
        },
      }),
    });

    if (!response.ok) {
      logger.error(
        { status: response.status, statusText: response.statusText },
        "创建永久 App Token 失败: 响应状态异常",
      );
      return null;
    }

    const body = (await response.json()) as AppTokenCreateResponse;
    const result = body.data?.appTokenCreate;
    const hasPermissionError = body.errors?.some(
      (error: GraphQLErrorDetail) =>
        (typeof error.message === "string" && error.message.includes("MANAGE_APPS")) ||
        error.extensions?.exception?.code === "PermissionDenied",
    );

    if (!result) {
      if (hasPermissionError) {
        logger.error(
          {
            permissions: ["MANAGE_APPS"],
            errors: body.errors,
          },
          "创建永久 App Token 失败: 缺少 MANAGE_APPS 权限，请在 Saleor 后台为应用授予该权限后重新安装",
        );
        return null;
      }

      logger.error({ body }, "创建永久 App Token 失败: 返回体缺少 appTokenCreate 字段");
      return null;
    }

    if (result.errors && result.errors.length > 0) {
      const resultHasPermissionError = result.errors.some(
        (error) =>
          (typeof error?.message === "string" && error.message.includes("MANAGE_APPS")) ||
          error?.code === "PermissionDenied",
      );
      if (resultHasPermissionError || hasPermissionError) {
        logger.error(
          {
            permissions: ["MANAGE_APPS"],
            errors: result.errors,
          },
          "创建永久 App Token 失败: 缺少 MANAGE_APPS 权限，请在 Saleor 后台为应用授予该权限后重新安装",
        );
        return null;
      }

      logger.error(
        {
          errors: result.errors,
        },
        "创建永久 App Token 失败: GraphQL 返回错误",
      );
      return null;
    }

    if (!result.authToken) {
      logger.error("创建永久 App Token 失败: 未返回 authToken");
      return null;
    }

    logger.info("成功创建永久 App Token");
    return result.authToken;
  } catch (error) {
    logger.error(
      "创建永久 App Token 时发生异常: " + (error instanceof Error ? error.message : "未知错误"),
    );
    return null;
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
    logger.info(
      "请求头信息: " +
        JSON.stringify({
          "saleor-domain": req.headers["saleor-domain"],
          "saleor-api-url": req.headers["saleor-api-url"] ? "***" : undefined,
          "x-forwarded-for": req.headers["x-forwarded-for"],
          "x-real-ip": req.headers["x-real-ip"],
        }),
    );
    logger.info("请求参数: " + JSON.stringify(req.body ? { auth_token: "***" } : {}));

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
    logger.info(
      "修正saleorApiUrl: " +
        (saleorApiUrl ? "***" : "未提供") +
        " -> " +
        (correctedUrl ? "***" : "未提供"),
    );

    // 尝试获取App ID（先尝试原始URL，如果失败再尝试修正后的URL）
    let appId = await getAppId(saleorApiUrl, authToken);
    if (!appId && correctedUrl !== saleorApiUrl) {
      logger.info("使用原始URL获取App ID失败，尝试修正后的URL");
      appId = await getAppId(correctedUrl, authToken);
    }
    if (!appId) {
      logger.warn(`无法获取App ID，使用默认ID。原始URL: ${saleorApiUrl}, 修正URL: ${correctedUrl}`);
      // 使用默认ID，确保安装可以继续进行
      appId = "app-placeholder-id";
    }

    // 尝试获取JWKS（先尝试原始URL，如果失败再尝试修正后的URL）
    let jwks = await fetchRemoteJwks(saleorApiUrl);
    if (!jwks && correctedUrl !== saleorApiUrl) {
      logger.info("使用原始URL获取JWKS失败，尝试修正后的URL");
      jwks = await fetchRemoteJwks(correctedUrl);
    }
    if (!jwks) {
      logger.warn("无法获取JWKS，使用默认JWKS");
      // 使用默认JWKS，确保安装可以继续进行
      jwks = "{}";
    }

    // 尝试注册站点
    let site = null;
    try {
      site = await siteManager.register({
        domain: saleorDomain as string,
        name: "", // 默认站点名称为空，让用户在config页面自定义
        saleorApiUrl: saleorApiUrl,
        clientIP:
          (req.headers["x-forwarded-for"] as string) ||
          (req.headers["x-real-ip"] as string) ||
          null,
        appId,
      });
      logger.info(`站点注册成功: ${site.id}`);
    } catch (siteError) {
      // 如果站点已存在，获取现有站点并更新appId
      if (siteError instanceof Error && siteError.message.includes("已经注册过了")) {
        site = await siteManager.getByDomain(saleorDomain as string);
        if (site) {
          logger.info(`使用现有站点: ${site.id}`);
          // 更新现有站点的appId
          const updatedSite = await siteManager.update(site.id, { appId });
          if (updatedSite) {
            site = updatedSite;
            logger.info(`更新现有站点的appId: ${site.id}`);
          }
        }
      } else {
        logger.warn(
          "站点注册失败，但继续安装流程: " +
            (siteError instanceof Error ? siteError.message : "未知错误"),
        );
        // 不中断安装流程，继续创建认证数据
        site = null;
      }
    }

    // 使用短期token交换长期token（若可行）
    let tokenToStore = authToken;
    if (appId && appId !== "app-placeholder-id") {
      // 优先使用修正后的URL尝试，失败则回退原始URL
      const potentialToken =
        (await createPermanentAppToken(saleorApiUrl, authToken, appId)) ||
        (correctedUrl !== saleorApiUrl
          ? await createPermanentAppToken(correctedUrl, authToken, appId)
          : null);

      if (potentialToken) {
        tokenToStore = potentialToken;
      } else {
        logger.warn("无法创建永久 App Token，保留原始安装 token");
      }
    } else {
      logger.warn("缺少有效的 appId，无法创建永久 App Token");
    }

    // 构建认证数据（如果有站点则关联站点ID）
    const authData: ExtendedAuthData = {
      domain: saleorDomain as string | undefined,
      token: tokenToStore,
      saleorApiUrl: saleorApiUrl, // 使用原始URL，让自动检测机制处理
      appId,
      jwks,
      siteId: site?.id, // 如果站点注册成功则关联站点ID
    };

    logger.info(
      "准备保存authData: " +
        JSON.stringify({
          domain: saleorDomain,
          saleorApiUrl: "***",
          appId,
          siteId: site?.id || "未关联",
          tokenPreview: tokenToStore?.substring(0, 10) + "...",
        }),
    );

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
