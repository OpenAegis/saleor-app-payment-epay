import React, { useEffect, useState } from "react";
import { Box, Text, Button } from "@saleor/macaw-ui";
import { useRouter } from "next/router";
import { DomainWhitelistManager } from "@/modules/ui/organisms/DomainWhitelistManager";

const DomainWhitelistPage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
            域名白名单管理
          </Text>
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

      <Box style={{ maxWidth: "1200px", margin: "0 auto" }} padding={6}>
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
    </Box>
  );
};

export default DomainWhitelistPage;
