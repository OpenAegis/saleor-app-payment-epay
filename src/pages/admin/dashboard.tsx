import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button, Box, Text } from "@saleor/macaw-ui";
import SiteManager from "../../components/SiteManager";
import ChannelManager from "../../components/ChannelManager";

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState("sites");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/plugin-admin/verify", {
        credentials: "include",
      });
      
      if (response.ok) {
        setIsAuthenticated(true);
      } else {
        router.push("/admin/login");
      }
    } catch (error) {
      router.push("/admin/login");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/plugin-admin/logout", {
        method: "POST",
        credentials: "include",
      });
      router.push("/admin/login");
    } catch (error) {
      console.error("Logout error:", error);
      router.push("/admin/login");
    }
  };

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        style={{ minHeight: "100vh" }}
      >
        <Text>加载中...</Text>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Box style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      <Box 
        padding={4} 
        backgroundColor="default1" 
        style={{ borderBottom: "1px solid #e5e5e5" }}
      >
        <Box 
          display="flex" 
          justifyContent="space-between" 
          alignItems="center"
          style={{ maxWidth: "1200px", margin: "0 auto" }}
        >
          <Text size={6} fontWeight="bold">
            多渠道支付管理后台
          </Text>
          <Button 
            variant="secondary" 
            onClick={handleLogout}
            size="medium"
          >
            退出登录
          </Button>
        </Box>
      </Box>

      <Box style={{ maxWidth: "1200px", margin: "0 auto" }} padding={6}>
        <Box marginBottom={6}>
          <Box display="flex" gap={2}>
            <Button
              variant={activeTab === "sites" ? "primary" : "secondary"}
              onClick={() => setActiveTab("sites")}
            >
              站点管理
            </Button>
            <Button
              variant={activeTab === "channels" ? "primary" : "secondary"}
              onClick={() => setActiveTab("channels")}
            >
              渠道管理
            </Button>
          </Box>
        </Box>

        {activeTab === "sites" && (
          <Box>
            <Box marginBottom={4}>
              <Text size={5} fontWeight="bold" marginBottom={2}>站点管理</Text>
              <Text size={3} color="default1">
                管理 Saleor 站点的安装申请和授权状态
              </Text>
            </Box>
            <SiteManager />
          </Box>
        )}

        {activeTab === "channels" && (
          <Box>
            <Box marginBottom={4}>
              <Text size={5} fontWeight="bold" marginBottom={2}>渠道管理</Text>
              <Text size={3} color="default1">
                管理支付渠道和网关配置
              </Text>
            </Box>
            <ChannelManager onChannelSelect={() => {}} />
          </Box>
        )}
      </Box>
    </Box>
  );
}