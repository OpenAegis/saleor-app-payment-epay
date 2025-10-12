import { createLogger } from "../logger";
import type { RegistrationRequest, ClientIPResult } from "./types";

const logger = createLogger({ component: "IPUtils" });

function isValidIP(ip: string): boolean {
  const cleanIP = ip.split(":")[0];
  
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  
  if (ipv4Regex.test(cleanIP)) {
    const parts = cleanIP.split(".").map(Number);
    // 排除私有IP范围
    if (
      parts[0] === 10 || // 10.0.0.0/8
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
      (parts[0] === 192 && parts[1] === 168) || // 192.168.0.0/16
      parts[0] === 127 || // 127.0.0.0/8 (localhost)
      parts[0] === 169 && parts[1] === 254 // 169.254.0.0/16 (link-local)
    ) {
      return false;
    }
    return true;
  }
  
  return ipv6Regex.test(cleanIP);
}

export function extractRealClientIP(req: RegistrationRequest): ClientIPResult {
  try {
    const ipHeaders = [
      "cf-connecting-ip", // Cloudflare
      "x-client-ip", // 通用客户端IP
      "x-forwarded-for", // 最常见的代理头
      "x-real-ip", // Nginx等常用
      "true-client-ip", // Akamai等CDN
      "x-originating-ip", // 某些代理
      "forwarded", // RFC 7239标准
    ] as const;

    for (const header of ipHeaders) {
      const value = req.headers[header];
      if (value) {
        let ip: string | null = null;
        
        if (header === "forwarded") {
          // forwarded 格式: "for=192.0.2.60;proto=http;by=203.0.113.43"
          const forwardedStr = Array.isArray(value) ? value[0] : value;
          if (typeof forwardedStr === "string") {
            const match = forwardedStr.match(/for=([^;,\s]+)/);
            if (match && match[1]) {
              ip = match[1].replace(/['"]/g, ""); // 移除可能的引号
            }
          }
        } else {
          // 其他头字段格式
          const ipStr = Array.isArray(value) ? value[0] : value;
          if (typeof ipStr === "string") {
            // 取第一个IP（如果有多个）
            ip = ipStr.split(",")[0].trim();
          }
        }

        if (ip && isValidIP(ip)) {
          logger.info(`从 ${header} 获取到客户端IP: ${ip}`);
          return { ip, source: header };
        }
      }
    }

    logger.warn("未能从请求头中提取有效的客户端IP");
    return { ip: null };
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : "未知错误" },
      "提取客户端IP时出错",
    );
    return { ip: null };
  }
}