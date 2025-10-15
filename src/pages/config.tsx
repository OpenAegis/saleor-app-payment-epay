import { useAppBridge, withAuthorization, useAuthenticatedFetch } from "@saleor/app-sdk/app-bridge";
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

const ConfigPage: NextPage = () => {
  const { appBridgeState, appBridge } = useAppBridge();
  const { token } = appBridgeState ?? {};
  const authenticatedFetch = useAuthenticatedFetch();

  const [saleorApiUrl, setSaleorApiUrl] = useState<string>("");
  const [isPlaceholderUrl, setIsPlaceholderUrl] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [siteAuth, setSiteAuth] = useState<SiteAuthResponse | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [siteName, setSiteName] = useState<string>("");
  const [savingSiteName, setSavingSiteName] = useState(false);

  // 支付通道状态
  const [channels, setChannels] = useState<{ configurationName: string; icon: string | null }[]>(
    [],
  );
  const [channelsLoading, setChannelsLoading] = useState(false);

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

        // 支付配置由插件超级管理员管理，这里不需要获取

        // 获取站点授权状态
        const siteAuthResponse = await authenticatedFetch("/api/check-site-auth");
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
        const saleorUrlResponse = await authenticatedFetch("/api/update-saleor-url");
        if (saleorUrlResponse.ok) {
          const urlData = (await saleorUrlResponse.json()) as SaleorUrlResponse;
          setSaleorApiUrl(urlData.saleorApiUrl || "");
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
      } catch (error) {
        console.error("获取配置失败:", error);
        setAuthError(error instanceof Error ? error.message : "获取配置失败");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      void fetchConfig();
    }
  }, [token]);

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
      const response = await authenticatedFetch("/api/update-site-name", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          siteName: siteName.trim(),
        }),
      });

      if (response.ok) {
        // 刷新站点授权状态以获取最新数据
        const siteAuthResponse = await authenticatedFetch("/api/check-site-auth");
        if (siteAuthResponse.ok) {
          const authData = (await siteAuthResponse.json()) as SiteAuthResponse;
          setSiteAuth(authData);
          setSiteName(authData.site?.name || "");
        }
        setSyncMessage("站点名称已成功更新");
      } else {
        const error = await response.json();
        setAuthError(`更新站点名称失败: ${error.error || "未知错误"}`);
      }
    } catch (error) {
      console.error("Failed to update site name:", error);
      setAuthError("更新站点名称失败，请重试");
    } finally {
      setSavingSiteName(false);
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
                        const saleorUrlResponse = await authenticatedFetch(
                          "/api/update-saleor-url",
                        );
                        if (saleorUrlResponse.ok) {
                          const urlData = (await saleorUrlResponse.json()) as SaleorUrlResponse;
                          setSaleorApiUrl(urlData.saleorApiUrl || "");
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
                        const siteAuthResponse = await authenticatedFetch("/api/check-site-auth");
                        if (siteAuthResponse.ok) {
                          const authData = (await siteAuthResponse.json()) as SiteAuthResponse;
                          setSiteAuth(authData);
                          // 更新站点名称
                          if (authData.site) {
                            setSiteName(authData.site.name || "");
                          }
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
            value={saleorApiUrl}
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
                onClick={handleSiteNameUpdate}
              >
                {savingSiteName ? "保存中..." : "保存"}
              </Button>
            </Box>
            {siteName !== siteAuth.site.name && siteName.trim() && (
              <Box padding={2} backgroundColor="warning1" borderRadius={4}>
                <p>⚠️ 站点名称已修改，请点击"保存"按钮保存更改</p>
              </Box>
            )}
          </Box>
        )}

        {/* 支付通道管理 */}
        <Box display="flex" flexDirection="column" gap={2}>
          <h3>支付通道管理</h3>

          <Box display="flex" flexDirection="column" gap={2} marginTop={2}>
            <h4>当前可用支付通道</h4>

            {/* TODO: 添加通道列表和排序功能 */}
            <Box padding={3} backgroundColor="default2" borderRadius={4}>
              <p>功能开发中：支付通道排序和启用/禁用控制</p>
            </Box>
          </Box>
        </Box>
      </Box>
    </AppLayout>
  );
};

export default withAuthorization()(ConfigPage);
