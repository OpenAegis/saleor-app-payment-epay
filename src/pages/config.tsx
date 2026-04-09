import { useAppBridge, withAuthorization } from "@saleor/app-sdk/app-bridge";
import { useState, useEffect, useRef } from "react";
import { Box, Input, Button } from "@saleor/macaw-ui";
import { type NextPage } from "next";
import { createPermanentAppTokenWithAdminCredentials } from "@/lib/saleor-app-token";
import { AppLayout } from "@/modules/ui/templates/AppLayout";

// 定义API响应接口

interface SaleorUrlResponse {
  saleorApiUrl: string;
  domain?: string;
  isPlaceholder: boolean;
  autoUpdated: boolean;
  changes?: {
    urlChanged: boolean;
    domainChanged: boolean;
    oldUrl: string;
    newUrl: string;
    oldDomain: string;
    newDomain: string;
  };
}

interface SiteAuthResponse {
  isAuthorized: boolean;
  site: {
    id: string;
    domain: string;
    name: string;
    status: string;
    requestedAt: string;
    approvedAt?: string;
    approvedBy?: string;
    notes?: string;
    lastActiveAt?: string;
  } | null;
  authData: {
    saleorApiUrl: string;
    domain: string;
    appId: string;
    hasToken: boolean;
    hasJwks: boolean;
    siteId?: string;
  };
  status: string;
  message: string;
}

interface ErrorResponse {
  error?: string;
}

// 添加通道接口
interface Channel {
  id: string;
  gatewayId: string;
  name: string;
  description: string | null;
  type: string;
  icon: string | null;
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

// 添加通道响应接口
interface ChannelsResponse {
  channels: Channel[];
}

// 添加全局配置响应接口
interface GlobalConfigResponse {
  returnUrl?: string;
}

const ConfigPage: NextPage = () => {
  const { appBridgeState } = useAppBridge();
  const { token, saleorApiUrl } = appBridgeState ?? {};

  const [saleorApiUrlState, setSaleorApiUrlState] = useState<string>("");
  const [isPlaceholderUrl, setIsPlaceholderUrl] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [siteAuth, setSiteAuth] = useState<SiteAuthResponse | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [siteName, setSiteName] = useState<string>("");
  const [savingSiteName, setSavingSiteName] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]); // 添加通道状态
  const [globalReturnUrl, setGlobalReturnUrl] = useState<string>(""); // 表单中的returnUrl
  const [savedGlobalReturnUrl, setSavedGlobalReturnUrl] = useState<string>(""); // 已保存的returnUrl
  const [savingReturnUrl, setSavingReturnUrl] = useState(false); // 添加保存状态
  const [saleorAdminEmail, setSaleorAdminEmail] = useState<string>("");
  const [saleorAdminPassword, setSaleorAdminPassword] = useState<string>("");
  const [generatingPermanentToken, setGeneratingPermanentToken] = useState(false);
  const [pastedPermanentToken, setPastedPermanentToken] = useState<string>("");
  const [savingPastedPermanentToken, setSavingPastedPermanentToken] = useState(false);
  const consoleScriptRef = useRef<HTMLTextAreaElement | null>(null);

  const applyGlobalConfig = (config: GlobalConfigResponse) => {
    const fetchedReturnUrl = config.returnUrl || "";
    setGlobalReturnUrl(fetchedReturnUrl);
    setSavedGlobalReturnUrl(fetchedReturnUrl);
  };

  // 页面加载时获取现有配置
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setAuthError(null);

        // 首先尝试使用公开端点诊断问题
        const diagnoseResponse = await fetch("/api/diagnose-config");
        if (diagnoseResponse.ok) {
          const diagnoseData = await diagnoseResponse.json();
          console.log("诊断信息:", diagnoseData);
        }

        // 获取站点授权状态
        const siteAuthResponse = await fetch("/api/check-site-auth", {
          headers: {
            "saleor-api-url": saleorApiUrl || "",
            authorization: `Bearer ${token}`,
          },
        });
        if (siteAuthResponse.ok) {
          const authData = (await siteAuthResponse.json()) as SiteAuthResponse;
          setSiteAuth(authData);
          // 设置站点名称
          if (authData.site) {
            setSiteName(authData.site.name || "");
          }
        } else {
          console.error("Failed to fetch site auth status");
        }

        // 获取Saleor API URL（同时自动同步domain）
        const saleorUrlResponse = await fetch("/api/update-saleor-url", {
          headers: {
            "saleor-api-url": saleorApiUrl || "",
            authorization: `Bearer ${token}`,
          },
        });
        if (saleorUrlResponse.ok) {
          const urlData = (await saleorUrlResponse.json()) as SaleorUrlResponse;
          setSaleorApiUrlState(urlData.saleorApiUrl || "");
          setIsPlaceholderUrl(urlData.isPlaceholder || false);

          // 显示自动同步信息
          if (urlData.autoUpdated && urlData.changes) {
            const messages = [];
            if (urlData.changes.domainChanged) {
              messages.push(
                `域名已自动同步: ${urlData.changes.oldDomain} → ${urlData.changes.newDomain}`,
              );
            }
            if (urlData.changes.urlChanged) {
              messages.push(`URL已自动更新: ${urlData.changes.oldUrl} → ${urlData.changes.newUrl}`);
            }
            if (messages.length > 0) {
              setSyncMessage(messages.join("; "));
            }
          }
        } else {
          const errorData = await saleorUrlResponse.json();
          setAuthError(
            errorData && typeof errorData === "object" && "error" in errorData
              ? String(errorData.error)
              : "获取Saleor URL失败",
          );
        }

        // 获取启用的支付通道列表
        const channelsResponse = await fetch("/api/public/channels");
        if (channelsResponse.ok) {
          const channelsData = (await channelsResponse.json()) as ChannelsResponse;
          setChannels(channelsData.channels || []);
        } else {
          console.error("Failed to fetch channels");
        }

        // 获取全局returnUrl配置
        const globalConfigResponse = await fetch("/api/global-config", {
          headers: {
            "saleor-api-url": saleorApiUrl || "",
            authorization: `Bearer ${token}`,
          },
        });
        if (globalConfigResponse.ok) {
          const globalConfigData = (await globalConfigResponse.json()) as GlobalConfigResponse;
          applyGlobalConfig(globalConfigData);
        } else {
          console.error("Failed to fetch global config");
        }
      } catch (error) {
        console.error("获取配置失败:", error);
        setAuthError(error instanceof Error ? error.message : "获取配置失败");
      } finally {
        setLoading(false);
      }
    };

    if (token && saleorApiUrl) {
      void fetchConfig();
    }
  }, [token, saleorApiUrl]);

  if (loading) {
    return (
      <AppLayout title="">
        <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
          <div>加载中...</div>
        </Box>
      </AppLayout>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "success1";
      case "pending":
        return "warning1";
      case "rejected":
        return "critical1";
      case "suspended":
        return "default2";
      default:
        return "default2";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("zh-CN");
  };

  const handleSiteNameUpdate = async () => {
    if (!token || !siteName.trim()) return;

    setSavingSiteName(true);
    try {
      const response = await fetch("/api/update-site-name", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "saleor-api-url": saleorApiUrl || "",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          siteName: siteName.trim(),
        }),
      });

      if (response.ok) {
        // 刷新站点授权状态以获取最新数据
        const siteAuthResponse = await fetch("/api/check-site-auth", {
          headers: {
            "saleor-api-url": saleorApiUrl || "",
            authorization: `Bearer ${token}`,
          },
        });
        if (siteAuthResponse.ok) {
          const authData = (await siteAuthResponse.json()) as SiteAuthResponse;
          setSiteAuth(authData);
          setSiteName(authData.site?.name || "");
        }
        setSyncMessage("站点名称已成功更新");
      } else {
        const error = await response.json();
        setAuthError(`更新站点名称失败: ${(error as ErrorResponse).error || "未知错误"}`);
      }
    } catch (error) {
      console.error("Failed to update site name:", error);
      setAuthError("更新站点名称失败，请重试");
    } finally {
      setSavingSiteName(false);
    }
  };

  // 添加处理全局returnUrl更新的函数
  const handleReturnUrlUpdate = async () => {
    if (!token) return;

    setSavingReturnUrl(true);
    try {
      const trimmedReturnUrl = globalReturnUrl.trim();
      const response = await fetch("/api/global-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "saleor-api-url": saleorApiUrl || "",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          returnUrl: trimmedReturnUrl || null, // 如果为空则传null
        }),
      });

      if (response.ok) {
        setSavedGlobalReturnUrl(trimmedReturnUrl);
        setSyncMessage("全局返回地址已成功更新");
      } else {
        const error = await response.json();
        setAuthError(`更新全局返回地址失败: ${(error as ErrorResponse).error || "未知错误"}`);
      }
    } catch (error) {
      console.error("Failed to update return url:", error);
      setAuthError("更新全局返回地址失败，请重试");
    } finally {
      setSavingReturnUrl(false);
    }
  };

  const handleCreatePermanentToken = async () => {
    if (!token) return;

    setGeneratingPermanentToken(true);
    try {
      setAuthError(null);
      const currentSaleorContext = getCurrentSaleorContext();

      if (!currentSaleorContext) {
        setAuthError("无法获取当前 Saleor API URL 或 App ID");
        return;
      }

      if (!saleorAdminEmail.trim() || !saleorAdminPassword.trim()) {
        setAuthError("请填写 Saleor 管理员邮箱和密码");
        return;
      }

      const permanentTokenResult = await createPermanentAppTokenWithAdminCredentials({
        saleorApiUrl: currentSaleorContext.currentSaleorApiUrl,
        appId: currentSaleorContext.appId,
        adminEmail: saleorAdminEmail.trim(),
        adminPassword: saleorAdminPassword,
      });

      const saved = await savePermanentToken(
        permanentTokenResult.authToken,
        currentSaleorContext.appId,
      );

      if (saved) {
        setSaleorAdminPassword("");
      }
    } catch (error) {
      console.error("Failed to create permanent token:", error);
      setAuthError("前端直连生成永久 Token 失败，请改用下方控制台脚本方案");
    } finally {
      setGeneratingPermanentToken(false);
    }
  };

  const handleSavePastedPermanentToken = async () => {
    const currentSaleorContext = getCurrentSaleorContext();

    if (!currentSaleorContext) {
      setAuthError("无法获取当前 Saleor API URL 或 App ID");
      return;
    }

    if (!pastedPermanentToken.trim()) {
      setAuthError("请先粘贴永久 Token");
      return;
    }

    setSavingPastedPermanentToken(true);
    try {
      setAuthError(null);
      const saved = await savePermanentToken(
        pastedPermanentToken.trim(),
        currentSaleorContext.appId,
      );

      if (saved) {
        setPastedPermanentToken("");
      }
    } finally {
      setSavingPastedPermanentToken(false);
    }
  };

  const handleSelectConsoleScript = () => {
    if (!consoleTokenScript) {
      setAuthError("无法生成控制台脚本，请先确认当前站点已完成安装");
      return;
    }

    consoleScriptRef.current?.focus();
    consoleScriptRef.current?.select();
    setSyncMessage("控制台脚本已选中，请按 Cmd/Ctrl+C 复制");
  };

  const getCurrentSaleorContext = () => {
    const currentSaleorApiUrl = siteAuth?.authData.saleorApiUrl || saleorApiUrlState || saleorApiUrl;
    const appId = siteAuth?.authData.appId;

    if (!currentSaleorApiUrl || !appId) {
      return null;
    }

    return { currentSaleorApiUrl, appId };
  };

  const buildConsoleTokenScript = (context: { currentSaleorApiUrl: string; appId: string } | null) => {
    if (!context) {
      return "";
    }

    return [
      "(async () => {",
      `  const saleorApiUrl = ${JSON.stringify(context.currentSaleorApiUrl)};`,
      `  const appId = ${JSON.stringify(context.appId)};`,
      `  const email = ${JSON.stringify(saleorAdminEmail.trim() || "__PASTE_ADMIN_EMAIL__")};`,
      '  const password = "__PASTE_ADMIN_PASSWORD__";',
      '  if (email === "__PASTE_ADMIN_EMAIL__" || password === "__PASTE_ADMIN_PASSWORD__") {',
      '    throw new Error("Please replace the email/password placeholders before running the script");',
      "  }",
      "",
      "  const request = async (query, variables, token) => {",
      '    const response = await fetch(saleorApiUrl, {',
      '      method: "POST",',
      '      headers: {',
      '        "Content-Type": "application/json",',
      '        ...(token ? { Authorization: `Bearer ${token}` } : {}),',
      "      },",
      "      body: JSON.stringify({ query, variables }),",
      "    });",
      "    const data = await response.json();",
      '    if (!response.ok) { throw new Error(`HTTP ${response.status}`); }',
      "    return data;",
      "  };",
      "",
      "  const login = await request(",
      '    `mutation AdminLogin($email: String!, $password: String!) {',
      '      tokenCreate(email: $email, password: $password) {',
      "        token",
      "        errors { message code }",
      "      }",
      "    }`,",
      "    { email, password },",
      "  );",
      "  const staffToken = login?.data?.tokenCreate?.token;",
      "  if (!staffToken) {",
      '    throw new Error(JSON.stringify(login?.data?.tokenCreate?.errors || "Login failed"));',
      "  }",
      "",
      "  const created = await request(",
      '    `mutation CreateAppToken($appId: ID!, $name: String!) {',
      '      appTokenCreate(input: { app: $appId, name: $name }) {',
      "        authToken",
      "        errors { message code }",
      "      }",
      "    }`,",
      '    { appId, name: `epay-permanent-${Date.now()}` },',
      "    staffToken,",
      "  );",
      "  const permanentToken = created?.data?.appTokenCreate?.authToken;",
      "  if (!permanentToken) {",
      '    throw new Error(JSON.stringify(created?.data?.appTokenCreate?.errors || "Create token failed"));',
      "  }",
      "  window.__SALEOR_PERMANENT_TOKEN__ = permanentToken;",
      '  console.log("window.__SALEOR_PERMANENT_TOKEN__ =", permanentToken);',
      '  console.log("Permanent token:", permanentToken);',
      "})();",
    ].join("\n");
  };

  const savePermanentToken = async (permanentToken: string, appId: string) => {
    if (!token) {
      return false;
    }

    const response = await fetch("/api/create-permanent-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "saleor-api-url": saleorApiUrl || "",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        permanentToken,
        appId,
      }),
    });

    const responseBody = (await response.json()) as ErrorResponse & { message?: string };

    if (!response.ok) {
      setAuthError(`保存永久 Token 失败: ${responseBody.error || "未知错误"}`);
      return false;
    }

    setSyncMessage(responseBody.message || "永久 Token 已保存");
    return true;
  };

  const currentSaleorContext = getCurrentSaleorContext();
  const consoleTokenScript = buildConsoleTokenScript(currentSaleorContext);

  return (
    <AppLayout title="">
      <Box display="flex" flexDirection="column" gap={4}>
        <h2>应用配置</h2>

        {authError && (
          <Box padding={2} backgroundColor="critical1" borderRadius={4}>
            <p>认证错误: {authError}</p>
            <p>请检查应用是否正确安装，或联系管理员。</p>
          </Box>
        )}

        {syncMessage && (
          <Box padding={2} backgroundColor="success1" borderRadius={4}>
            <p>✅ {syncMessage}</p>
          </Box>
        )}

        {/* 站点授权状态 */}
        {siteAuth && (
          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <h3>站点授权状态</h3>
              <Button
                type="button"
                variant="secondary"
                size="small"
                disabled={loading}
                onClick={() => {
                  if (token) {
                    setLoading(true);
                    setSyncMessage(null); // 清除之前的同步消息
                    void (async () => {
                      try {
                        // 先刷新URL和domain（可能触发自动同步）
                        const saleorUrlResponse = await fetch("/api/update-saleor-url", {
                          headers: {
                            "saleor-api-url": saleorApiUrl || "",
                            authorization: `Bearer ${token}`,
                          },
                        });
                        if (saleorUrlResponse.ok) {
                          const urlData = (await saleorUrlResponse.json()) as SaleorUrlResponse;
                          setSaleorApiUrlState(urlData.saleorApiUrl || "");
                          setIsPlaceholderUrl(urlData.isPlaceholder || false);

                          // 显示自动同步信息
                          if (urlData.autoUpdated && urlData.changes) {
                            const messages = [];
                            if (urlData.changes.domainChanged) {
                              messages.push(
                                `域名已自动同步: ${urlData.changes.oldDomain} → ${urlData.changes.newDomain}`,
                              );
                            }
                            if (urlData.changes.urlChanged) {
                              messages.push(
                                `URL已自动更新: ${urlData.changes.oldUrl} → ${urlData.changes.newUrl}`,
                              );
                            }
                            if (messages.length > 0) {
                              setSyncMessage(messages.join("; "));
                            }
                          }
                        }

                        // 然后刷新授权状态
                        const siteAuthResponse = await fetch("/api/check-site-auth", {
                          headers: {
                            "saleor-api-url": saleorApiUrl || "",
                            authorization: `Bearer ${token}`,
                          },
                        });
                        if (siteAuthResponse.ok) {
                          const authData = (await siteAuthResponse.json()) as SiteAuthResponse;
                          setSiteAuth(authData);
                          // 更新站点名称
                          if (authData.site) {
                            setSiteName(authData.site.name || "");
                          }
                        }

                        // 刷新通道列表
                        const channelsResponse = await fetch("/api/public/channels");
                        if (channelsResponse.ok) {
                          const channelsData = (await channelsResponse.json()) as ChannelsResponse;
                          setChannels(channelsData.channels || []);
                        }

                        // 刷新全局配置
                        const globalConfigResponse = await fetch("/api/global-config", {
                          headers: {
                            "saleor-api-url": saleorApiUrl || "",
                            authorization: `Bearer ${token}`,
                          },
                        });
                        if (globalConfigResponse.ok) {
                          const globalConfigData =
                            (await globalConfigResponse.json()) as GlobalConfigResponse;
                          applyGlobalConfig(globalConfigData);
                        }
                      } catch (error) {
                        console.error("Failed to refresh status:", error);
                      } finally {
                        setLoading(false);
                      }
                    })();
                  }
                }}
              >
                {loading ? "刷新中..." : "🔄 刷新状态"}
              </Button>
            </Box>
            <Box
              padding={3}
              backgroundColor={siteAuth.isAuthorized ? "success1" : getStatusColor(siteAuth.status)}
              borderRadius={4}
            >
              <h4 style={{ margin: "0 0 8px 0" }}>
                {siteAuth.isAuthorized ? "🔐 已授权" : "🔒 未授权"}
              </h4>
              <p style={{ margin: "0 0 8px 0" }}>{siteAuth.message}</p>

              {siteAuth.site && (
                <Box display="flex" flexDirection="column" gap={1} marginTop={2}>
                  <div>
                    <strong>站点域名:</strong> {siteAuth.site.domain}
                  </div>
                  <div>
                    <strong>站点名称:</strong> {siteAuth.site.name}
                  </div>
                  <div>
                    <strong>状态:</strong> {siteAuth.site.status}
                  </div>
                  <div>
                    <strong>申请时间:</strong> {formatDate(siteAuth.site.requestedAt)}
                  </div>
                  {siteAuth.site.approvedAt && (
                    <div>
                      <strong>批准时间:</strong> {formatDate(siteAuth.site.approvedAt)}
                    </div>
                  )}
                  {siteAuth.site.approvedBy && (
                    <div>
                      <strong>批准人:</strong> {siteAuth.site.approvedBy}
                    </div>
                  )}
                  {siteAuth.site.notes && (
                    <div>
                      <strong>备注:</strong> {siteAuth.site.notes}
                    </div>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Saleor API URL 配置 */}
        <Box display="flex" flexDirection="column" gap={2}>
          <h3>Saleor API URL配置</h3>
          <Input
            label="Saleor API URL"
            value={saleorApiUrlState}
            readOnly
            placeholder="https://your-saleor-instance.com/graphql/"
            helperText={
              isPlaceholderUrl
                ? "系统将自动检测并更新为正确的Saleor实例URL"
                : "当前配置的Saleor实例URL（自动检测）"
            }
          />
          {isPlaceholderUrl ? (
            <Box padding={2} backgroundColor="info1" borderRadius={4}>
              <p>ℹ️ 系统会自动从请求头检测您的Saleor实例URL并更新配置</p>
            </Box>
          ) : (
            <Box padding={2} backgroundColor="success1" borderRadius={4}>
              <p>✅ Saleor API URL已自动配置完成</p>
            </Box>
          )}
        </Box>

        {/* 站点名称配置 */}
        {siteAuth?.site && (
          <Box display="flex" flexDirection="column" gap={2}>
            <h3>站点名称配置</h3>
            <Box display="flex" gap={2} alignItems="end">
              <Box style={{ flex: 1 }}>
                <Input
                  label="站点名称"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="请输入您的店铺名称"
                  helperText="自定义您的店铺显示名称"
                />
              </Box>
              <Button
                type="button"
                variant="primary"
                disabled={savingSiteName || !siteName.trim() || siteName === siteAuth.site.name}
                onClick={() => {
                  void handleSiteNameUpdate();
                }}
              >
                {savingSiteName ? "保存中..." : "保存"}
              </Button>
            </Box>
            {siteName !== siteAuth.site.name && siteName.trim() && (
              <Box padding={2} backgroundColor="warning1" borderRadius={4}>
                <p>⚠️ 站点名称已修改，请点击&#34;保存&#34;按钮保存更改</p>
              </Box>
            )}
          </Box>
        )}

        {/* 全局返回地址配置 */}
        <Box display="flex" flexDirection="column" gap={2}>
          <h3>全局返回地址配置</h3>
          <Box display="flex" gap={2} alignItems="end">
            <Box style={{ flex: 1 }}>
              <Input
                label="全局返回地址"
                value={globalReturnUrl}
                onChange={(e) => setGlobalReturnUrl(e.target.value)}
                placeholder="https://your-store-domain.com/checkout/success"
                helperText="支付完成后跳转的默认地址，如果前端未传入return_url则使用此地址，留空则移除return_url参数。支持占位符：{transaction_id} 会在跳转时替换为实际的交易ID"
              />
            </Box>
            <Button
              type="button"
              variant="primary"
              disabled={
                savingReturnUrl || globalReturnUrl.trim() === savedGlobalReturnUrl
              }
              onClick={() => {
                void handleReturnUrlUpdate();
              }}
            >
              {savingReturnUrl ? "保存中..." : "保存"}
            </Button>
          </Box>
          {globalReturnUrl.trim() !== savedGlobalReturnUrl && (
            <Box padding={2} backgroundColor="warning1" borderRadius={4}>
              <p>⚠️ 全局返回地址已修改，请点击“保存”按钮保存更改</p>
            </Box>
          )}
          {savedGlobalReturnUrl && (
            <Box padding={2} backgroundColor="success1" borderRadius={4}>
              <p>✅ 全局返回地址已设置：{savedGlobalReturnUrl}</p>
            </Box>
          )}
          {!savedGlobalReturnUrl && (
            <Box padding={2} backgroundColor="info1" borderRadius={4}>
              <p>ℹ️ 未设置全局返回地址，如果前端未传入return_url则不会添加return_url参数</p>
            </Box>
          )}
          <Box padding={2} backgroundColor="info1" borderRadius={4}>
            <p>
              💡
              提示：您可以在URL中使用占位符，例如：https://your-store-domain.com/checkout/success/&#123;transaction_id&#125;
            </p>
          </Box>
        </Box>

        <Box display="flex" flexDirection="column" gap={2}>
          <h3>Saleor 管理员凭据（永久 Token）</h3>
          <Box padding={2} backgroundColor="info1" borderRadius={4}>
            <p>方案一：当前页面直接请求 Saleor 生成永久 Token；如果浏览器遇到跨域，再用下方控制台脚本方案。</p>
          </Box>
          <Input
            label="管理员邮箱"
            value={saleorAdminEmail}
            onChange={(e) => setSaleorAdminEmail(e.target.value)}
            placeholder="admin@example.com"
            helperText="填写 Saleor 后台管理员邮箱。账号密码只在当前浏览器会话里使用。"
          />
          <Input
            label="管理员密码"
            type="password"
            value={saleorAdminPassword}
            onChange={(e) => setSaleorAdminPassword(e.target.value)}
            placeholder="请输入管理员密码"
            helperText="密码只在浏览器里用于直连 Saleor 生成永久 Token，不会保存到应用。"
          />
          <Box display="flex" gap={2} alignItems="end">
            <Button
              type="button"
              variant="primary"
              disabled={
                generatingPermanentToken ||
                !currentSaleorContext ||
                !saleorAdminEmail.trim() ||
                !saleorAdminPassword.trim()
              }
              onClick={() => {
                void handleCreatePermanentToken();
              }}
            >
              {generatingPermanentToken ? "生成中..." : "前端生成并保存永久 Token"}
            </Button>
          </Box>
          <Box padding={2} backgroundColor="info1" borderRadius={4}>
            <p>ℹ️ 管理员账号密码不会经过应用后端，也不会写入应用配置；前端只会把生成好的永久 Token 提交给应用保存。</p>
          </Box>
          <Box padding={2} backgroundColor="default2" borderRadius={4}>
            <h4 style={{ marginTop: 0 }}>方案二：控制台脚本（跨域备用）</h4>
            <p>复制下面脚本，到 Saleor 后台主页面的浏览器控制台执行。脚本不会使用 prompt 或剪贴板；请先把脚本里的密码占位符替换成真实密码，再执行。</p>
            <Box display="flex" gap={2} marginBottom={2}>
              <Button
                type="button"
                variant="secondary"
                disabled={!consoleTokenScript}
                onClick={() => {
                  handleSelectConsoleScript();
                }}
              >
                选中控制台脚本
              </Button>
            </Box>
            <textarea
              ref={consoleScriptRef}
              readOnly
              value={consoleTokenScript}
              style={{
                width: "100%",
                minHeight: "240px",
                padding: "12px",
                fontFamily: "monospace",
                fontSize: "12px",
                borderRadius: "8px",
                border: "1px solid #d9d9d9",
                resize: "vertical",
              }}
            />
            <Box display="flex" gap={2} alignItems="end" marginTop={2}>
              <Box style={{ flex: 1 }}>
                <Input
                  label="粘贴永久 Token"
                  value={pastedPermanentToken}
                  onChange={(e) => setPastedPermanentToken(e.target.value)}
                  placeholder="把控制台输出的永久 Token 粘贴到这里"
                />
              </Box>
              <Button
                type="button"
                variant="secondary"
                disabled={
                  savingPastedPermanentToken ||
                  !currentSaleorContext ||
                  !pastedPermanentToken.trim()
                }
                onClick={() => {
                  void handleSavePastedPermanentToken();
                }}
              >
                {savingPastedPermanentToken ? "保存中..." : "保存粘贴的 Token"}
              </Button>
            </Box>
            <Box padding={2} backgroundColor="info1" borderRadius={4} marginTop={2}>
              <p>脚本执行成功后，会把永久 Token 输出到控制台，并写到 `window.__SALEOR_PERMANENT_TOKEN__`，再手动复制回来保存即可。</p>
            </Box>
          </Box>
        </Box>

        {/* 支付通道列表预览 */}
        <Box display="flex" flexDirection="column" gap={2}>
          <h3>支付通道列表</h3>
          {channels.length > 0 ? (
            <Box display="flex" flexDirection="column" gap={2}>
              {channels.map((channel) => (
                <Box
                  key={channel.id}
                  padding={3}
                  backgroundColor="default2"
                  borderRadius={4}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box>
                    <div>
                      <strong>{channel.name}</strong>
                    </div>
                    {channel.description && (
                      <div style={{ marginTop: "4px", fontSize: "14px", color: "#666" }}>
                        {channel.description}
                      </div>
                    )}
                    <div style={{ marginTop: "4px", fontSize: "12px", color: "#999" }}>
                      类型: {channel.type}
                    </div>
                  </Box>
                  <Box
                    padding={1}
                    backgroundColor={channel.enabled ? "success1" : "critical1"}
                    borderRadius={2}
                    fontSize={1}
                  >
                    {channel.enabled ? "启用" : "禁用"}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Box padding={3} backgroundColor="default2" borderRadius={4}>
              <p>暂无可用的支付通道</p>
            </Box>
          )}
        </Box>
      </Box>
    </AppLayout>
  );
};

export default withAuthorization()(ConfigPage);
