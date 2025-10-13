import { useAppBridge, withAuthorization } from "@saleor/app-sdk/app-bridge";
import { useState, useEffect } from "react";
import { Box, Input, Button } from "@saleor/macaw-ui";
import { type NextPage } from "next";
import { AppLayout } from "@/modules/ui/templates/AppLayout";
import { EpayConfigurationForm } from "@/modules/ui/organisms/EpayConfigurationForm";
import { type EpayFormConfig } from "@/modules/payment-app-configuration/epay-config";

// 定义API响应接口
interface EpayConfigResponse {
  configurations: Array<{
    pid: string;
    key: string;
    apiUrl: string;
    returnUrl?: string;
    configurationName: string;
    enabled: boolean;
  }>;
  channelToConfigurationId: Record<string, string>;
}

interface SaleorUrlResponse {
  saleorApiUrl: string;
  isPlaceholder: boolean;
}

const ConfigPage: NextPage = () => {
  const { appBridgeState, appBridge } = useAppBridge();
  const { token } = appBridgeState ?? {};

  const [epayConfig, setEpayConfig] = useState<EpayFormConfig | null>(null);
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

        // 获取支付配置
        const epayResponse = await appBridge?.fetch("/api/epay-config") ?? await fetch("/api/epay-config");
        if (epayResponse.ok) {
          const config = (await epayResponse.json()) as EpayConfigResponse;
          // 获取第一个配置项作为当前配置
          if (config.configurations && config.configurations.length > 0) {
            const firstConfig = config.configurations[0];
            setEpayConfig({
              pid: firstConfig.pid,
              key: firstConfig.key,
              apiUrl: firstConfig.apiUrl,
              returnUrl: firstConfig.returnUrl || "",
              configurationName: firstConfig.configurationName,
              enabled: firstConfig.enabled,
            });
          }
        } else {
          // 如果认证端点失败，尝试公开端点
          const publicEpayResponse = await fetch("/api/epay-config-public");
          if (publicEpayResponse.ok) {
            const config = (await publicEpayResponse.json()) as EpayConfigResponse;
            if (config.configurations && config.configurations.length > 0) {
              const firstConfig = config.configurations[0];
              setEpayConfig({
                pid: firstConfig.pid,
                key: firstConfig.key,
                apiUrl: firstConfig.apiUrl,
                returnUrl: firstConfig.returnUrl || "",
                configurationName: firstConfig.configurationName,
                enabled: firstConfig.enabled,
              });
            }
          } else {
            const errorData = await epayResponse.json();
            setAuthError(
              errorData && typeof errorData === "object" && "error" in errorData
                ? String(errorData.error)
                : "获取支付配置失败",
            );
          }
        }

        // 获取Saleor API URL
        const saleorUrlResponse = await appBridge?.fetch("/api/update-saleor-url") ?? await fetch("/api/update-saleor-url");
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

  const saveEpayConfig = async (config: EpayFormConfig) => {
    try {
      const configWithId = {
        ...config,
        configurationId: "epay-config-1",
        configurationName: config.configurationName || "彩虹易支付",
      };

      const response = await appBridge?.fetch("/api/epay-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(configWithId),
      }) ?? await fetch("/api/epay-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(configWithId),
      });

      if (response.ok) {
        await appBridge?.dispatch({
          type: "notification",
          payload: {
            title: "配置已保存",
            text: "彩虹易支付配置已成功保存",
            status: "success",
            actionId: "epay-config",
          },
        });
        setEpayConfig(config);
      } else {
        const errorData = await response.json();
        const errorMessage =
          errorData && typeof errorData === "object" && "error" in errorData
            ? String(errorData.error)
            : "Failed to save epay config";
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("保存彩虹易支付配置时出错:", error);
      await appBridge?.dispatch({
        type: "notification",
        payload: {
          title: "保存失败",
          text: error instanceof Error ? error.message : "保存彩虹易支付配置时出错",
          status: "error",
          actionId: "epay-config",
        },
      });
    }
  };

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
      const response = await appBridge?.fetch("/api/update-saleor-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ saleorApiUrl }),
      }) ?? await fetch("/api/update-saleor-url", {
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

        {/* 彩虹易支付配置 */}
        <Box display="flex" flexDirection="column" gap={2}>
          <h3>彩虹易支付配置</h3>
          <EpayConfigurationForm
            initialConfig={epayConfig || undefined}
            onSave={(config) => void saveEpayConfig(config)}
            onCancel={() => {}}
          />
        </Box>
      </Box>
    </AppLayout>
  );
};

export default withAuthorization()(ConfigPage);
