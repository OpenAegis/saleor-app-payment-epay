export interface GlobalConfig {
  returnUrl?: string;
}

export const GLOBAL_CONFIG_KEY = "global_payment_config";

export function parseGlobalConfig(configStr?: string | null): GlobalConfig {
  if (!configStr) {
    return {};
  }

  try {
    const parsed = JSON.parse(configStr) as GlobalConfig;

    return {
      returnUrl: typeof parsed.returnUrl === "string" ? parsed.returnUrl : undefined,
    };
  } catch {
    return {};
  }
}
