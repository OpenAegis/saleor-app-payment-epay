import { type NextPage } from "next";
import { useState, useEffect } from "react";
import { useAppBridge, withAuthorization } from "@saleor/app-sdk/app-bridge";
import { Box, Text, Button } from "@saleor/macaw-ui";
import { AppLayout } from "@/modules/ui/templates/AppLayout";
import { ChannelManager } from "../components/ChannelManager";
import { AdminGatewayManager } from "../components/AdminGatewayManager";
import { UserGatewayConfig } from "../components/UserGatewayConfig";
import { PluginAdminLogin } from "../components/PluginAdminLogin";
import { SiteManager } from "../components/SiteManager";
import type { Channel } from "../lib/models/channel";

const PaymentConfigPage: NextPage = () => {
  const { appBridgeState } = useAppBridge();
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isPluginAdmin, setIsPluginAdmin] = useState<boolean | null>(null);
  const [currentView, setCurrentView] = useState<"user" | "admin" | "sites">("user");
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  // 检查插件管理员会话
  const checkPluginAdminSession = async () => {
    try {
      const res = await fetch("/api/plugin-admin/verify");
      if (res.ok) {
        const data = await res.json();
        const response = data as { authenticated: boolean };
        setIsPluginAdmin(response.authenticated);
      } else {
        setIsPluginAdmin(false);
      }
    } catch (error) {
      setIsPluginAdmin(false);
    }
  };

  // 初始加载时检查会话
  useEffect(() => {
    if (appBridgeState?.ready) {
      void checkPluginAdminSession();
    }
  }, [appBridgeState?.ready]);

  // 处理插件管理员登录成功
  const handleAdminLoginSuccess = async () => {
    setShowAdminLogin(false);
    await checkPluginAdminSession();
    setCurrentView("admin");
  };

  // 处理插件管理员登出
  const handleAdminLogout = async () => {
    try {
      await fetch("/api/plugin-admin/logout", { method: "POST" });
      setIsPluginAdmin(false);
      setCurrentView("user");
      setSelectedChannel(null);
    } catch (error) {
      console.error("登出失败:", error);
    }
  };

  // 检查是否已授权
  if (!appBridgeState?.ready) {
    return (
      <AppLayout title="多渠道支付配置">
        <Box padding={6}>
          <div>正在连接到 Saleor...</div>
        </Box>
      </AppLayout>
    );
  }

  // 权限检查中
  if (isPluginAdmin === null) {
    return (
      <AppLayout title="多渠道支付配置">
        <Box padding={6}>
          <div>正在检查权限...</div>
        </Box>
      </AppLayout>
    );
  }

  // 显示插件管理员登录界面
  if (showAdminLogin) {
    return (
      <AppLayout title="插件管理员登录">
        <Box padding={6}>
          <PluginAdminLogin onLoginSuccess={handleAdminLoginSuccess} />
          <Box display="flex" justifyContent="center" marginTop={4}>
            <Button type="button" size="medium" onClick={() => setShowAdminLogin(false)}>
              返回用户界面
            </Button>
          </Box>
        </Box>
      </AppLayout>
    );
  }

  // 插件管理员界面
  if (isPluginAdmin) {
    return (
      <AppLayout title="多渠道支付配置">
        <Box padding={6}>
          {/* 顶部操作栏 */}
          <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={4}>
            <Box display="flex" gap={2}>
              <Button
                type="button"
                variant={currentView === "admin" ? "primary" : "secondary"}
                onClick={() => setCurrentView("admin")}
              >
                🔧 支付管理
              </Button>
              <Button
                type="button"
                variant={currentView === "sites" ? "primary" : "secondary"}
                onClick={() => setCurrentView("sites")}
              >
                🏢 站点授权
              </Button>
              <Button
                type="button"
                variant={currentView === "user" ? "primary" : "secondary"}
                onClick={() => setCurrentView("user")}
              >
                👁️ 用户预览
              </Button>
            </Box>
            <Button
              type="button"
              variant="tertiary"
              size="medium"
              onClick={handleAdminLogout}
            >
              🚪 登出管理员
            </Button>
          </Box>

          {currentView === "admin" ? (
            <>
              {selectedChannel ? (
                <AdminGatewayManager
                  channel={selectedChannel}
                  onBack={() => setSelectedChannel(null)}
                />
              ) : (
                <ChannelManager onChannelSelect={setSelectedChannel} />
              )}
            </>
          ) : currentView === "sites" ? (
            <SiteManager />
          ) : (
            <UserGatewayConfig />
          )}
        </Box>
      </AppLayout>
    );
  }

  // 普通Saleor管理员界面（只能查看和启用/禁用）
  return (
    <AppLayout title="支付通道配置">
      <Box padding={6}>
        <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={4}>
          <Text size={5}>
            你当前是普通用户模式，只能查看和启用/禁用通道
          </Text>
          <Button
            type="button"
            onClick={() => setShowAdminLogin(true)}
          >
            🔐 插件管理员登录
          </Button>
        </Box>
        <UserGatewayConfig />
      </Box>
    </AppLayout>
  );
};

export default withAuthorization({
  notIframe: true,
})(PaymentConfigPage);
