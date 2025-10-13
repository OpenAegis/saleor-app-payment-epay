import { useAppBridge, withAuthorization, useAuthenticatedFetch } from "@saleor/app-sdk/app-bridge";
import { useState, useEffect } from "react";
import { Box, Input, Button } from "@saleor/macaw-ui";
import { type NextPage } from "next";
import { AppLayout } from "@/modules/ui/templates/AppLayout";

// 定义API响应接口

interface SaleorUrlResponse {
  saleorApiUrl: string;
  isPlaceholder: boolean;
}

const ConfigPage: NextPage = () => {
  const { appBridgeState, appBridge } = useAppBridge();
  const { token } = appBridgeState ?? {};
  const authenticatedFetch = useAuthenticatedFetch();

  const [saleorApiUrl, setSaleorApiUrl] = useState<string>("");
  const [isPlaceholderUrl, setIsPlaceholderUrl] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

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

        // 获取Saleor API URL
        const saleorUrlResponse = await authenticatedFetch("/api/update-saleor-url");
        if (saleorUrlResponse.ok) {
          const urlData = (await saleorUrlResponse.json()) as SaleorUrlResponse;
          setSaleorApiUrl(urlData.saleorApiUrl || "");
          setIsPlaceholderUrl(urlData.isPlaceholder || false);
        } else {
          // 如果认证端点失败，尝试公开端点
          const publicSaleorUrlResponse = await fetch("/api/update-saleor-url-public");
          if (publicSaleorUrlResponse.ok) {
            const urlData = (await publicSaleorUrlResponse.json()) as SaleorUrlResponse;
            setSaleorApiUrl(urlData.saleorApiUrl || "");
            setIsPlaceholderUrl(urlData.isPlaceholder || false);
          } else {
            const errorData = await saleorUrlResponse.json();
            setAuthError(
              errorData && typeof errorData === "object" && "error" in errorData
                ? String(errorData.error)
                : "获取Saleor URL失败",
            );
          }
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


  const saveSaleorApiUrl = async () => {
    if (!saleorApiUrl) {
      await appBridge?.dispatch({
        type: "notification",
        payload: {
          title: "保存失败",
          text: "请输入Saleor API URL",
          status: "error",
          actionId: "saleor-url",
        },
      });
      return;
    }

    try {
      const response = await authenticatedFetch("/api/update-saleor-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ saleorApiUrl }),
      });

      if (response.ok) {
        await response.json();
        await appBridge?.dispatch({
          type: "notification",
          payload: {
            title: "URL已保存",
            text: "Saleor API URL已成功保存",
            status: "success",
            actionId: "saleor-url",
          },
        });
        setIsPlaceholderUrl(false);
      } else {
        const errorData = await response.json();
        const errorMessage =
          errorData && typeof errorData === "object" && "error" in errorData
            ? String(errorData.error)
            : "Failed to save Saleor API URL";
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("保存Saleor API URL时出错:", error);
      await appBridge?.dispatch({
        type: "notification",
        payload: {
          title: "保存失败",
          text: error instanceof Error ? error.message : "保存Saleor API URL时出错",
          status: "error",
          actionId: "saleor-url",
        },
      });
    }
  };

  if (loading) {
    return (
      <AppLayout title="">
        <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
          <div>加载中...</div>
        </Box>
      </AppLayout>
    );
  }

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

        {/* Saleor API URL 配置 */}
        <Box display="flex" flexDirection="column" gap={2}>
          <h3>Saleor API URL配置</h3>
          <Input
            label="Saleor API URL"
            value={saleorApiUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSaleorApiUrl(e.target.value)}
            placeholder="https://your-saleor-instance.com/graphql/"
            helperText={isPlaceholderUrl ? "请输入您的Saleor实例URL" : "当前配置的Saleor实例URL"}
          />
          {isPlaceholderUrl && (
            <Box padding={2} backgroundColor="warning1" borderRadius={4}>
              <p>注意：当前使用的是占位符URL，请输入您的实际Saleor实例URL</p>
            </Box>
          )}
          <Box display="flex" gap={2}>
            <Button onClick={() => void saveSaleorApiUrl()}>保存Saleor URL</Button>
          </Box>
        </Box>

        {/* 支付通道管理 */}
        <Box display="flex" flexDirection="column" gap={2}>
          <h3>支付通道管理</h3>
          <Box padding={2} backgroundColor="info1" borderRadius={4}>
            <p>⚠️ 易支付配置信息（PID、密钥等）只能由插件超级管理员设置。</p>
            <p>Saleor管理员只能管理支付通道的排序和启用状态。</p>
            <p>如需配置易支付信息，请访问: <a href="/admin/login" target="_blank" rel="noopener noreferrer">插件管理后台</a></p>
          </Box>
          
          <Box display="flex" flexDirection="column" gap={2} marginTop={4}>
            <h4>当前可用支付通道</h4>
            <p>支付通道的创建和配置需要通过插件管理后台完成。</p>
            <p>在这里您可以查看为当前销售渠道配置的支付通道状态。</p>
            
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
