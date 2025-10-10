import { useAppBridge, withAuthorization } from "@saleor/app-sdk/app-bridge";
import { useState } from "react";
import { Box, Button } from "@saleor/macaw-ui";
import { type NextPage } from "next";
import { AppLayout } from "@/modules/ui/templates/AppLayout";
import { EpayConfigurationForm } from "@/modules/ui/organisms/EpayConfigurationForm";
import { type EpayFormConfig } from "@/modules/payment-app-configuration/epay-config";

const ConfigPage: NextPage = () => {
  const { appBridgeState, appBridge } = useAppBridge();
  const { token } = appBridgeState ?? {};

  const [epayConfig, setEpayConfig] = useState<EpayFormConfig | null>(null);

  const saveEpayConfig = async (config: EpayFormConfig) => {
    try {
      const response = await fetch("/api/epay-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
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
    } catch (error) {
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

  return (
    <AppLayout title="">
      <Box display="flex" flexDirection="column" gap={4}>
        <h2>彩虹易支付配置</h2>
        <EpayConfigurationForm 
          initialConfig={epayConfig || undefined}
          onSave={saveEpayConfig}
          onCancel={() => {}}
        />
      </Box>
    </AppLayout>
  );
};

export default withAuthorization()(ConfigPage);