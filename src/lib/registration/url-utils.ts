import { createLogger } from "../logger";
import type { RegistrationRequest, SaleorUrlInfo } from "./types";

const logger = createLogger({ component: "UrlUtils" });

export function isLocalhost(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    return hostname === 'localhost' || 
           hostname === '127.0.0.1' || 
           hostname === '::1' ||
           hostname.endsWith('.localhost');
  } catch {
    return false;
  }
}

export function extractSaleorUrlFromHeaders(req: RegistrationRequest): SaleorUrlInfo | null {
  const { headers } = req;
  
  // Priority: saleor-api-url > saleor-domain > origin > referer
  if (headers['saleor-api-url'] && typeof headers['saleor-api-url'] === 'string') {
    const saleorApiUrl = headers['saleor-api-url'];
    logger.info(`发现saleor-api-url请求头: ${saleorApiUrl}`);
    
    try {
      const saleorDomain = new URL(saleorApiUrl).hostname;
      return {
        saleorApiUrl,
        saleorDomain,
        source: 'saleor-domain'
      };
    } catch (error) {
      logger.warn(`无法解析saleor-api-url: ${saleorApiUrl}`);
    }
  }
  
  if (headers['saleor-domain'] && typeof headers['saleor-domain'] === 'string') {
    const saleorDomain = headers['saleor-domain'];
    logger.info(`发现saleor-domain请求头: ${saleorDomain}`);
    
    const protocol = saleorDomain.includes('localhost') ? 'http' : 'https';
    const saleorApiUrl = `${protocol}://${saleorDomain}/graphql/`;
    
    return {
      saleorApiUrl,
      saleorDomain,
      source: 'saleor-domain'
    };
  }
  
  if (headers.origin && typeof headers.origin === 'string' && !isLocalhost(headers.origin)) {
    logger.info(`尝试从Origin请求头构建URL: ${headers.origin}`);
    
    try {
      const originUrl = new URL(headers.origin);
      return {
        saleorApiUrl: `${headers.origin}/graphql/`,
        saleorDomain: originUrl.hostname,
        source: 'origin'
      };
    } catch (error) {
      logger.warn(`无法解析Origin URL: ${headers.origin}`);
    }
  }
  
  if (headers.referer && typeof headers.referer === 'string' && !isLocalhost(headers.referer)) {
    logger.info(`尝试从Referer请求头构建URL: ${headers.referer}`);
    
    try {
      const refererUrl = new URL(headers.referer);
      return {
        saleorApiUrl: `${refererUrl.protocol}//${refererUrl.host}/graphql/`,
        saleorDomain: refererUrl.hostname,
        source: 'referer'
      };
    } catch (error) {
      logger.warn(`无法解析Referer URL: ${headers.referer}`);
    }
  }
  
  return null;
}

export function normalizeApiUrl(saleorApiUrl: string): string {
  if (!saleorApiUrl.endsWith('/graphql/')) {
    return saleorApiUrl.endsWith('/') 
      ? `${saleorApiUrl}graphql/`
      : `${saleorApiUrl}/graphql/`;
  }
  return saleorApiUrl;
}