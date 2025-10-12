import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import SiteManager from "../../components/SiteManager";
import ChannelManager from "../../components/ChannelManager";

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
      <div className="min-h-screen flex items-center justify-center">
        <div>加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              多渠道支付管理后台
            </h1>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              size="sm"
            >
              退出登录
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Tabs defaultValue="sites" className="space-y-6">
          <TabsList>
            <TabsTrigger value="sites">站点管理</TabsTrigger>
            <TabsTrigger value="channels">渠道管理</TabsTrigger>
          </TabsList>

          <TabsContent value="sites" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>站点管理</CardTitle>
                <CardDescription>
                  管理 Saleor 站点的安装申请和授权状态
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SiteManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="channels" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>渠道管理</CardTitle>
                <CardDescription>
                  管理支付渠道和网关配置
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChannelManager />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}