import { useState } from "react";
import { Box, Button, Input } from "@saleor/macaw-ui";
import { type EpayFormConfig } from "@/modules/payment-app-configuration/epay-config";

interface EpayConfigurationFormProps {
  initialConfig?: EpayFormConfig;
  onSave: (config: EpayFormConfig) => void;
  onCancel: () => void;
}

export const EpayConfigurationForm = ({
  initialConfig,
  onSave,
  onCancel,
}: EpayConfigurationFormProps) => {
  const [config, setConfig] = useState<EpayFormConfig>(
    initialConfig || {
      pid: "",
      key: "",
      apiUrl: "",
      configurationName: "",
      enabled: true,
    }
  );

  const handleChange = (field: keyof EpayFormConfig, value: string | boolean) => {
    setConfig((prev: EpayFormConfig) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    onSave(config);
  };

  return (
    <Box display="flex" flexDirection="column" gap={4}>
      <h2>彩虹易支付配置</h2>
      
      <Input
        label="配置名称"
        value={config.configurationName}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("configurationName", e.target.value)}
        required
      />
      
      <Input
        label="商户ID (PID)"
        value={config.pid}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("pid", e.target.value)}
        required
      />
      
      <Input
        label="商户密钥"
        value={config.key}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("key", e.target.value)}
        type="password"
        required
      />
      
      <Input
        label="API地址"
        value={config.apiUrl}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("apiUrl", e.target.value)}
        required
      />
      
      <Box display="flex" gap={2}>
        <Button onClick={handleSubmit}>保存配置</Button>
        <Button onClick={onCancel} variant="secondary">
          取消
        </Button>
      </Box>
    </Box>
  );
};