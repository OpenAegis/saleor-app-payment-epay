import { useAppBridge, withAuthorization } from "@saleor/app-sdk/app-bridge";
import { useState, useEffect } from "react";
import { Box } from "@saleor/macaw-ui";
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

const ConfigPage: NextPage = () => {
  const { appBridgeState, appBridge } = useAppBridge();
  const { token } = appBridgeState ?? {};

  const [epayConfig, setEpayConfig] = useState<EpayFormConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // 页面加载时获取现有配置
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/epay-config");
        if (response.ok) {
          const config = (await response.json()) as EpayConfigResponse;
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
        }
      } catch (_error) {
        console.error("获取配置失败:", _error);
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

      const response = await fetch("/api/epay-config", {
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
        throw new Error("Failed to save epay config");
      }
    } catch (_error) {
      await appBridge?.dispatch({
        type: "notification",
        payload: {
          title: "保存失败",
          text: "保存彩虹易支付配置时出错",
          status: "error",
          actionId: "epay-config",
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
        <h2>彩虹易支付配置</h2>
        <EpayConfigurationForm
          initialConfig={epayConfig || undefined}
          onSave={(config) => void saveEpayConfig(config)}
          onCancel={() => {}}
        />
      </Box>
    </AppLayout>
  );
};

export default withAuthorization()(ConfigPage);
