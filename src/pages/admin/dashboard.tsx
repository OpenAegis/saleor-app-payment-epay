import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button, Box, Text } from "@saleor/macaw-ui";
import SiteAuthManager from "../../components/SiteAuthManager";
import ChannelManager from "../../components/ChannelManager";
import GatewayManager from "../../components/GatewayManager";
import { DomainWhitelistManager } from "@/modules/ui/organisms/DomainWhitelistManager";

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState("sites");

  useEffect(() => {
    void checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/plugin-admin/verify", {
        credentials: "include",
      });

      if (response.ok) {
        setIsAuthenticated(true);
      } else {
        void router.push("/admin/login");
      }
    } catch (_error) {
      void router.push("/admin/login");
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
      void router.push("/admin/login");
    } catch (_error) {
      void router.push("/admin/login");
    }
  };

  const handleInitDatabase = async () => {
    if (!confirm("确定要初始化/更新数据库结构吗？这个操作是安全的，会自动检测需要添加的字段。")) {
      return;
    }

    try {
      const response = await fetch("/api/admin/init-database", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        alert("数据库初始化成功！新的字段已添加。");
      } else {
        const error = await response.text();
        alert(`数据库初始化失败: ${error}`);
      }
    } catch (error) {
      alert(`数据库初始化失败: ${error}`);
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
      <Box padding={4} backgroundColor="default1" style={{ borderBottom: "1px solid #e5e5e5" }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          style={{ maxWidth: "1200px", margin: "0 auto" }}
        >
          <Text size={6} fontWeight="bold">
            多渠道支付管理后台
          </Text>
          <Box display="flex" gap={2}>
            <Button
              variant="tertiary"
              onClick={() => {
                void handleInitDatabase();
              }}
              size="medium"
            >
              初始化数据库
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void handleLogout();
              }}
              size="medium"
            >
              退出登录
            </Button>
          </Box>
        </Box>
      </Box>

      <Box style={{ maxWidth: "1200px", margin: "0 auto" }} padding={6}>
        <Box marginBottom={6}>
          <Box display="flex" gap={2}>
            <Button
              variant={activeTab === "sites" ? "primary" : "secondary"}
              onClick={() => setActiveTab("sites")}
            >
              站点授权管理
            </Button>
            <Button
              variant={activeTab === "gateways" ? "primary" : "secondary"}
              onClick={() => setActiveTab("gateways")}
            >
              渠道管理
            </Button>
            <Button
              variant={activeTab === "channels" ? "primary" : "secondary"}
              onClick={() => setActiveTab("channels")}
            >
              通道管理
            </Button>
            <Button
              variant={activeTab === "domain-whitelist" ? "primary" : "secondary"}
              onClick={() => setActiveTab("domain-whitelist")}
            >
              域名白名单
            </Button>
          </Box>
        </Box>

        {activeTab === "sites" && (
          <Box>
            <Box marginBottom={4}>
              <Text size={5} fontWeight="bold" marginBottom={2}>
                站点授权管理
              </Text>
              <Text size={3} color="default1">
                管理 Saleor 站点的安装申请、授权状态和认证数据
              </Text>
            </Box>
            <SiteAuthManager />
          </Box>
        )}

        {activeTab === "gateways" && (
          <Box>
            <Box marginBottom={4}>
              <Text size={5} fontWeight="bold" marginBottom={2}>
                渠道管理
              </Text>
              <Text size={3} color="default1">
                管理易支付渠道配置（API地址、商户ID、密钥等）
              </Text>
            </Box>
            <GatewayManager />
          </Box>
        )}

        {activeTab === "channels" && (
          <Box>
            <Box marginBottom={4}>
              <Text size={5} fontWeight="bold" marginBottom={2}>
                通道管理
              </Text>
              <Text size={3} color="default1">
                管理支付通道配置（选择渠道和支付类型）
              </Text>
            </Box>
            <ChannelManager />
          </Box>
        )}

        {activeTab === "domain-whitelist" && (
          <Box>
            <Box marginBottom={4}>
              <Text size={5} fontWeight="bold" marginBottom={2}>
                域名白名单管理
              </Text>
              <Text size={3} color="default1">
                管理允许安装此支付插件的域名。只有在白名单中的域名才能成功安装插件。
              </Text>
            </Box>
            <DomainWhitelistManager />
          </Box>
        )}
      </Box>
    </Box>
  );
}
