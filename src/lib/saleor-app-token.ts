interface CurrentAppResponse {
  data?: {
    app?: {
      id?: string | null;
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
