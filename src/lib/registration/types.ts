import type { NextApiRequest } from "next";

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  details?: any;
}

export interface ClientIPResult {
  ip: string | null;
  source?: string;
}

export interface SaleorUrlInfo {
  saleorApiUrl: string;
  saleorDomain: string;
  source: 'saleor-domain' | 'origin' | 'referer' | 'auth-data';
}

export interface RegistrationAuthData {
  saleorApiUrl: string;
  domain: string;
  appId: string;
  token: string;
}

export interface RegistrationRequest extends NextApiRequest {
  headers: NextApiRequest['headers'] & {
    'saleor-domain'?: string;
    'saleor-api-url'?: string;
    origin?: string;
    referer?: string;
    'cf-connecting-ip'?: string;
    'x-client-ip'?: string;
    'x-forwarded-for'?: string;
    'x-real-ip'?: string;
    'true-client-ip'?: string;
    'x-originating-ip'?: string;
    forwarded?: string;
  };
  body: NextApiRequest['body'] & {
    auth_token?: string;
    [key: string]: any;
  };
}

export interface RegistrationResult {
  success: boolean;
  error?: string;
  message?: string;
  details?: any;
}