import { useAppBridge, withAuthorization } from "@saleor/app-sdk/app-bridge";
import { useState, useEffect } from "react";
import { Box, Input, Button, Text } from "@saleor/macaw-ui";
import { type NextPage } from "next";
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

  const site = siteAuth?.site;
  const siteNameDirty = Boolean(site && siteName.trim() && siteName !== site.name);
  const returnUrlDirty = globalReturnUrl.trim() !== savedGlobalReturnUrl;
  const unsavedItems = [siteNameDirty ? "站点名称" : null, returnUrlDirty ? "返回地址" : null].filter(
    Boolean,
  );
  const enabledChannelsCount = channels.filter((channel) => channel.enabled).length;
  const statusBackgroundColor = siteAuth
    ? siteAuth.isAuthorized
      ? "success1"
      : getStatusColor(siteAuth.status)
    : "default2";

  return (
    <AppLayout
      title="应用配置"
      description="先确认授权与连接状态，再完成基础支付配置。"
    >
      <Box display="flex" flexDirection="column" gap={4}>
        {authError && (
          <Box padding={2} backgroundColor="critical1" borderRadius={4}>
            <Text size={3} fontWeight="bold">
              认证错误
            </Text>
            <Text size={3}>{authError}</Text>
            <Text size={2} color="default1">
              请检查应用是否正确安装，或联系管理员。
            </Text>
          </Box>
        )}

        {syncMessage && (
          <Box padding={2} backgroundColor="success1" borderRadius={4}>
            <Text size={3} fontWeight="bold">
              已更新
            </Text>
            <Text size={3}>{syncMessage}</Text>
          </Box>
        )}

        {/* 站点授权状态 */}
        {siteAuth && (
          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box display="flex" flexDirection="column" gap={1}>
                <Text as="h2" size={6} fontWeight="bold">
                  当前状态
                </Text>
                <Text size={3} color="default1" style={{ marginTop: "-0.25rem", maxWidth: "60ch" }}>
                  {siteAuth.isAuthorized ? "授权正常，可以继续配置。" : "请先处理授权问题，再继续配置。"}
                </Text>
              </Box>
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
              backgroundColor={statusBackgroundColor}
              borderRadius={4}
            >
              <Text as="h3" size={5} fontWeight="bold" style={{ marginBottom: "0.5rem" }}>
                {siteAuth.isAuthorized ? "已就绪" : "需要处理"}
              </Text>
              <Text size={3} style={{ maxWidth: "62ch", lineHeight: 1.55 }}>
                {siteAuth.message}
              </Text>
              <Box
                marginTop={2}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "12px",
                }}
              >
                <Box padding={2} backgroundColor="default2" borderRadius={4}>
                  <Text size={2} color="default2">
                    站点
                  </Text>
                  <Text size={4} fontWeight="bold" style={{ marginTop: "0.375rem" }}>
                    {site?.name || "-"}
                  </Text>
                  <Text size={2} color="default2" style={{ marginTop: "0.25rem" }}>
                    {site?.domain || siteAuth.authData.domain || "-"}
                  </Text>
                </Box>
                <Box padding={2} backgroundColor="default2" borderRadius={4}>
                  <Text size={2} color="default2">
                    授权状态
                  </Text>
                  <Text size={4} fontWeight="bold" style={{ marginTop: "0.375rem" }}>
                    {siteAuth.status}
                  </Text>
                  {site?.approvedAt && (
                    <Text size={2} color="default2" style={{ marginTop: "0.25rem" }}>
                      批准于 {formatDate(site.approvedAt)}
                    </Text>
                  )}
                </Box>
                <Box padding={2} backgroundColor="default2" borderRadius={4}>
                  <Text size={2} color="default2">
                    Saleor API URL
                  </Text>
                  <Text
                    size={2}
                    style={{
                      marginTop: "0.375rem",
                      lineHeight: 1.5,
                      wordBreak: "break-all",
                    }}
                  >
                    {saleorApiUrlState || siteAuth.authData.saleorApiUrl || "-"}
                  </Text>
                </Box>
                <Box padding={2} backgroundColor="default2" borderRadius={4}>
                  <Text size={2} color="default2">
                    已启用通道
                  </Text>
                  <Text
                    size={4}
                    fontWeight="bold"
                    style={{ marginTop: "0.375rem", fontVariantNumeric: "tabular-nums" }}
                  >
                    {enabledChannelsCount} / {channels.length}
                  </Text>
                  <Text size={2} color="default2" style={{ marginTop: "0.25rem" }}>
                    {isPlaceholderUrl ? "URL 仍在等待自动校正" : "连接信息已完成自动检测"}
                  </Text>
                </Box>
              </Box>
              {(site?.notes || !siteAuth.isAuthorized) && (
                <Text size={2} color="default1" style={{ marginTop: "0.75rem", maxWidth: "65ch" }}>
                  {site?.notes ? `备注：${site.notes}` : "授权未就绪时，先处理状态问题，再保存业务配置。"}
                </Text>
              )}
            </Box>
          </Box>
        )}

        <Box display="flex" flexDirection="column" gap={2}>
          <Text as="h2" size={6} fontWeight="bold">
            基础配置
          </Text>
          <Text size={3} color="default1" style={{ marginTop: "-0.25rem", maxWidth: "60ch" }}>
            只保留完成支付接入所需的基础项，减少阅读负担。
          </Text>

          {site && (
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
                disabled={savingSiteName || !siteName.trim() || siteName === site.name}
                onClick={() => {
                  void handleSiteNameUpdate();
                }}
              >
                {savingSiteName ? "保存中..." : "保存"}
              </Button>
            </Box>
          )}
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
          {unsavedItems.length > 0 && (
            <Box padding={2} backgroundColor="warning1" borderRadius={4}>
              <Text size={3}>有未保存的修改：{unsavedItems.join("、")}</Text>
            </Box>
          )}
          <Box padding={2} backgroundColor="info1" borderRadius={4}>
            <Text size={3} style={{ maxWidth: "65ch", lineHeight: 1.55 }}>
              当前版本仅使用安装时写入的 App Token。若当前站点从旧版本升级而来，请部署本版本后重新安装一次 App，以刷新安装 Token。
            </Text>
          </Box>
        </Box>

        {/* 支付通道列表预览 */}
        <Box display="flex" flexDirection="column" gap={2}>
          <Text as="h2" size={6} fontWeight="bold">
            支付通道
          </Text>
          <Text size={3} color="default1" style={{ marginTop: "-0.25rem", maxWidth: "60ch" }}>
            用于快速核对当前前台可见的支付方式。
          </Text>
          {channels.length > 0 ? (
            <Box padding={2} backgroundColor="default2" borderRadius={4}>
              {channels.map((channel) => (
                <Box
                  key={channel.id}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  style={{
                    padding: "12px 0",
                    borderTop:
                      channels[0]?.id === channel.id ? "none" : "1px solid rgba(0, 0, 0, 0.08)",
                  }}
                >
                  <Box>
                    <Text size={4} fontWeight="bold">
                      {channel.name}
                    </Text>
                    <Text size={2} color="default2" style={{ marginTop: "0.25rem", maxWidth: "55ch" }}>
                      类型：{channel.type}
                      {channel.description ? ` · ${channel.description}` : ""}
                    </Text>
                  </Box>
                  <Box padding={1} backgroundColor={channel.enabled ? "success1" : "default2"} borderRadius={2}>
                    <Text size={1} fontWeight="bold">
                      {channel.enabled ? "启用" : "禁用"}
                    </Text>
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Box padding={3} backgroundColor="default2" borderRadius={4}>
              <Text size={3}>还没有可用通道。</Text>
            </Box>
          )}
        </Box>
      </Box>
    </AppLayout>
  );
};

export default withAuthorization()(ConfigPage);
