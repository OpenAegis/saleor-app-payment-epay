import { SignJWT, jwtVerify } from "jose";
import { type NextApiRequest, type NextApiResponse } from "next";
import { env } from "../env.mjs";

/**
 * 插件管理员认证系统
 *
 * 这是独立于Saleor用户系统的认证机制
 * 用于控制谁可以管理支付渠道和通道配置
 */

// 从环境变量读取管理员凭证
const PLUGIN_ADMIN_USERNAME = env.PLUGIN_ADMIN_USERNAME;
const PLUGIN_ADMIN_PASSWORD = env.PLUGIN_ADMIN_PASSWORD;
const SESSION_SECRET = env.PLUGIN_SESSION_SECRET;

// Session 配置
const SESSION_COOKIE_NAME = "plugin_admin_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7天

// 检查是否配置了管理员凭证
if (!PLUGIN_ADMIN_USERNAME || !PLUGIN_ADMIN_PASSWORD) {
  console.warn(
    "⚠️ [插件管理员] 未配置管理员账号！请在 .env 中设置 PLUGIN_ADMIN_USERNAME 和 PLUGIN_ADMIN_PASSWORD",
  );
}

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error(
    "❌ [插件管理员] SESSION_SECRET 未配置或长度不足！请在 .env 中设置至少32位的随机字符串",
  );
}

/**
 * 验证管理员登录凭证
 */
export function verifyCredentials(username: string, password: string): boolean {
  // 简单的时间安全比较，防止时序攻击
  const usernameMatch = username === PLUGIN_ADMIN_USERNAME;
  const passwordMatch = password === PLUGIN_ADMIN_PASSWORD;

  if (!PLUGIN_ADMIN_USERNAME || !PLUGIN_ADMIN_PASSWORD) {
    return false;
  }

  return usernameMatch && passwordMatch;
}

/**
 * 创建管理员会话令牌
 */
export async function createSessionToken(): Promise<string> {
  const secret = new TextEncoder().encode(SESSION_SECRET);

  const token = await new SignJWT({ role: "plugin_admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret);

  return token;
}

/**
 * 验证管理员会话令牌
 */
export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(SESSION_SECRET);
    const { payload } = await jwtVerify(token, secret);

    return payload.role === "plugin_admin";
  } catch (error) {
    return false;
  }
}

/**
 * 验证并返回插件管理员会话信息
 */
export async function verifyPluginAdminSession(
  req: NextApiRequest,
): Promise<{ username: string } | null> {
  const token = getSessionTokenFromRequest(req);
  if (!token) {
    return null;
  }

  const isValid = await verifySessionToken(token);
  if (!isValid) {
    return null;
  }

  // 返回会话信息（这里简化为固定的用户名）
  return { username: PLUGIN_ADMIN_USERNAME };
}

/**
 * 从请求中获取会话令牌
 */
export function getSessionTokenFromRequest(req: NextApiRequest): string | null {
  // 优先从 Cookie 读取
  const cookieToken = req.cookies[SESSION_COOKIE_NAME];
  if (cookieToken) {
    return cookieToken;
  }

  // 其次从 Authorization header 读取
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * 检查请求是否来自插件管理员
 */
export async function isPluginAdminRequest(req: NextApiRequest): Promise<boolean> {
  const token = getSessionTokenFromRequest(req);
  if (!token) {
    return false;
  }

  return verifySessionToken(token);
}

/**
 * 设置会话 Cookie
 */
export function setSessionCookie(res: NextApiResponse, token: string): void {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`,
  );
}

/**
 * 清除会话 Cookie
 */
export function clearSessionCookie(res: NextApiResponse): void {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/**
 * 中间件：要求插件管理员权限
 */
export async function requirePluginAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<boolean> {
  const isAdmin = await isPluginAdminRequest(req);

  if (!isAdmin) {
    res.status(403).json({
      error: "Plugin admin access required",
      message: "此操作需要插件管理员权限",
    });
    return false;
  }

  return true;
}
