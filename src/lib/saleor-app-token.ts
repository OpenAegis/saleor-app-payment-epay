interface SaleorError {
  field?: string | null;
  message?: string | null;
  code?: string | null;
}

interface CurrentAppResponse {
  data?: {
    app?: {
      id?: string | null;
    } | null;
  };
}

interface TokenCreateResponse {
  data?: {
    tokenCreate?: {
      token?: string | null;
      errors?: SaleorError[];
    } | null;
  };
}

interface AppTokenCreateResponse {
  data?: {
    appTokenCreate?: {
      authToken?: string | null;
      appToken?: {
        id?: string | null;
      } | null;
      errors?: SaleorError[];
    } | null;
  };
}

const CURRENT_APP_QUERY = `
  query CurrentApp {
    app {
      id
    }
  }
`;

const ADMIN_TOKEN_CREATE_MUTATION = `
  mutation AdminLogin($email: String!, $password: String!) {
    tokenCreate(email: $email, password: $password) {
      token
      errors { field message code }
    }
  }
`;

const APP_TOKEN_CREATE_MUTATION = `
  mutation CreateAppToken($appId: ID!, $name: String!) {
    appTokenCreate(input: { app: $appId, name: $name }) {
      authToken
      appToken { id }
      errors { field message code }
    }
  }
`;

function formatSaleorErrors(errors?: SaleorError[]) {
  if (!errors?.length) {
    return "";
  }

  return errors
    .map((error) => error.message || error.code || error.field || "未知错误")
    .join("; ");
}

async function executeGraphql<T>(
  saleorApiUrl: string,
  query: string,
  variables: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const response = await fetch(saleorApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Saleor API HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchCurrentAppId(
  saleorApiUrl: string,
  token: string,
): Promise<string | undefined> {
  try {
    const response = await executeGraphql<CurrentAppResponse>(
      saleorApiUrl,
      CURRENT_APP_QUERY,
      {},
      token,
    );

    return response.data?.app?.id ?? undefined;
  } catch {
    return undefined;
  }
}

export async function createPermanentAppTokenWithAdminCredentials({
  saleorApiUrl,
  appId,
  adminEmail,
  adminPassword,
  tokenName,
}: {
  saleorApiUrl: string;
  appId: string;
  adminEmail: string;
  adminPassword: string;
  tokenName?: string;
}): Promise<{ authToken: string; tokenId?: string }> {
  const loginResponse = await executeGraphql<TokenCreateResponse>(
    saleorApiUrl,
    ADMIN_TOKEN_CREATE_MUTATION,
    { email: adminEmail, password: adminPassword },
  );

  const staffToken = loginResponse.data?.tokenCreate?.token;

  if (!staffToken) {
    const loginErrors = formatSaleorErrors(loginResponse.data?.tokenCreate?.errors);
    throw new Error(loginErrors ? `管理员登录失败: ${loginErrors}` : "管理员登录失败: 未返回 token");
  }

  const appTokenResponse = await executeGraphql<AppTokenCreateResponse>(
    saleorApiUrl,
    APP_TOKEN_CREATE_MUTATION,
    {
      appId,
      name: tokenName || `epay-permanent-${Date.now()}`,
    },
    staffToken,
  );

  const authToken = appTokenResponse.data?.appTokenCreate?.authToken;

  if (!authToken) {
    const createErrors = formatSaleorErrors(appTokenResponse.data?.appTokenCreate?.errors);
    throw new Error(
      createErrors ? `永久 Token 创建失败: ${createErrors}` : "永久 Token 创建失败: 未返回 authToken",
    );
  }

  return {
    authToken,
    tokenId: appTokenResponse.data?.appTokenCreate?.appToken?.id ?? undefined,
  };
}
