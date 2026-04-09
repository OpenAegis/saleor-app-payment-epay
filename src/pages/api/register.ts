import type { NextApiRequest, NextApiResponse } from "next";
import { saleorApp } from "../../saleor-app";
import { createLogger } from "../../lib/logger";
import { siteManager } from "../../lib/managers/site-manager";
import { type ExtendedAuthData } from "../../lib/turso-apl";

/**
 * 使用 Saleor 管理员账号为本 App 创建永久 Token。
 * 要求 env: SALEOR_ADMIN_EMAIL, SALEOR_ADMIN_PASSWORD
 */
async function createPermanentTokenWithAdminCredentials(
  saleorApiUrl: string,
  appId: string,
): Promise<string | null> {
  const adminEmail = process.env.SALEOR_ADMIN_EMAIL;
  const adminPassword = process.env.SALEOR_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    logger.warn(
      "未配置 SALEOR_ADMIN_EMAIL / SALEOR_ADMIN_PASSWORD，跳过永久 Token 创建。" +
        "安装 token 为 JWT，过期后将无法处理回调。建议配置管理员凭据。",
    );
    return null;
  }

  try {
    // Step 1: 用管理员账号换取临时 staff token
    const loginResp = await fetch(saleorApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          mutation Login($email: String!, $password: String!) {
            tokenCreate(email: $email, password: $password) {
              token
              errors { field message code }
            }
          }
        `,
        variables: { email: adminEmail, password: adminPassword },
      }),
    });

    if (!loginResp.ok) {
      logger.error({ status: loginResp.status }, "管理员登录失败: HTTP 错误");
      return null;
    }

    const loginBody = (await loginResp.json()) as {
      data?: { tokenCreate?: { token?: string; errors?: { message?: string }[] } };
    };
    const staffToken = loginBody.data?.tokenCreate?.token;
    const loginErrors = loginBody.data?.tokenCreate?.errors;

    if (!staffToken) {
      logger.error(
        { errors: loginErrors },
        "管理员登录失败: 未返回 token，请检查 SALEOR_ADMIN_EMAIL / SALEOR_ADMIN_PASSWORD",
      );
      return null;
    }

    // Step 2: 用 staff token 调用 appTokenCreate
    const createResp = await fetch(saleorApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        query: `
          mutation AppTokenCreate($appId: ID!, $name: String!) {
            appTokenCreate(input: { app: $appId, name: $name }) {
              authToken
              errors { field message code }
            }
          }
        `,
        variables: { appId, name: `epay-permanent-${Date.now()}` },
      }),
    });

    if (!createResp.ok) {
      logger.error({ status: createResp.status }, "appTokenCreate HTTP 错误");
      return null;
    }

    const createBody = (await createResp.json()) as {
      data?: { appTokenCreate?: { authToken?: string; errors?: { message?: string }[] } };
    };
    const permanentToken = createBody.data?.appTokenCreate?.authToken;
    const createErrors = createBody.data?.appTokenCreate?.errors;

    if (!permanentToken) {
      logger.error({ errors: createErrors }, "appTokenCreate 失败: 未返回 authToken");
      return null;
    }

    logger.info("✅ 成功创建永久 App Token（通过管理员账号）");
    return permanentToken;
  } catch (error) {
    logger.error(
      "创建永久 Token 异常: " + (error instanceof Error ? error.message : "未知错误"),
    );
    return null;
  }
}

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

    // 尝试用管理员账号创建永久 Token（需配置 SALEOR_ADMIN_EMAIL / SALEOR_ADMIN_PASSWORD）
    let tokenToStore = authToken;
    if (appId && appId !== "app-placeholder-id") {
      const permanentToken = await createPermanentTokenWithAdminCredentials(saleorApiUrl, appId);
      if (permanentToken) {
        tokenToStore = permanentToken;
        logger.info("将使用永久 Token 替换安装 JWT");
      } else {
        logger.warn(
          "未能创建永久 Token，将存储安装 JWT（有效期较短，过期后回调处理将失败）",
        );
      }
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
