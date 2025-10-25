import { useAppBridge, withAuthorization } from "@saleor/app-sdk/app-bridge";
import { useState, useEffect } from "react";
import { Box, Input, Button } from "@saleor/macaw-ui";
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
  const [globalReturnUrl, setGlobalReturnUrl] = useState<string>(""); // 添加全局returnUrl状态
  const [savingReturnUrl, setSavingReturnUrl] = useState(false); // 添加保存状态

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
          setGlobalReturnUrl(globalConfigData.returnUrl || "");
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
      const response = await fetch("/api/global-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "saleor-api-url": saleorApiUrl || "",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          returnUrl: globalReturnUrl.trim() || null, // 如果为空则传null
        }),
      });

      if (response.ok) {
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
                          setGlobalReturnUrl(globalConfigData.returnUrl || "");
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
                helperText="支付完成后跳转的默认地址，如果前端未传入return_url则使用此地址，留空则移除return_url参数"
              />
            </Box>
            <Button
              type="button"
              variant="primary"
              disabled={
                savingReturnUrl ||
                globalReturnUrl ===
                  (siteAuth?.site?.domain ? `https://${siteAuth.site.domain}/checkout/success` : "")
              }
              onClick={() => {
                void handleReturnUrlUpdate();
              }}
            >
              {savingReturnUrl ? "保存中..." : "保存"}
            </Button>
          </Box>
          {globalReturnUrl && (
            <Box padding={2} backgroundColor="success1" borderRadius={4}>
              <p>✅ 全局返回地址已设置：{globalReturnUrl}</p>
            </Box>
          )}
          {!globalReturnUrl && (
            <Box padding={2} backgroundColor="info1" borderRadius={4}>
              <p>ℹ️ 未设置全局返回地址，如果前端未传入return_url则不会添加return_url参数</p>
            </Box>
          )}
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
