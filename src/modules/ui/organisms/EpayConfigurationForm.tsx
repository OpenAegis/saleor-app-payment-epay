import { useState } from "react";
import { Box, Button, Input, Text } from "@saleor/macaw-ui";
import { type EpayFormConfig } from "@/modules/payment-app-configuration/epay-config";

interface TestResult {
  success: boolean;
  message: string;
}

interface TestResponse {
  success: boolean;
  message?: string;
}

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
      returnUrl: "",
      configurationName: "",
      enabled: true,
    }
  );
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleChange = (field: keyof EpayFormConfig, value: string | boolean) => {
    setConfig((prev: EpayFormConfig) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    onSave(config);
  };
  
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const response = await fetch("/api/epay-config/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });
      
      const result = (await response.json()) as TestResponse;
      
      if (response.ok && result.success) {
        setTestResult({ success: true, message: "连接成功！商户信息验证通过。" });
      } else {
        setTestResult({ success: false, message: result.message || "连接失败，请检查配置信息。" });
      }
    } catch (_error) {
      setTestResult({ success: false, message: "测试连接时发生错误。" });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Box display="flex" flexDirection="column" gap={4}>
      <h2>彩虹易支付配置</h2>
      
      <Input
        label="配置名称"
        value={config.configurationName}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("configurationName", e.target.value)}
        required
        helperText="为这个支付配置设置一个易于识别的名称"
      />
      
      <Input
        label="商户ID (PID)"
        value={config.pid}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("pid", e.target.value)}
        required
        helperText="在彩虹易支付商户后台获取"
      />
      
      <Input
        label="商户密钥"
        value={config.key}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("key", e.target.value)}
        type="password"
        required
        helperText="在彩虹易支付商户后台获取，请妥善保管"
      />
      
      <Input
        label="API地址"
        value={config.apiUrl}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("apiUrl", e.target.value)}
        required
        helperText="您的彩虹易支付服务提供商提供的API地址"
        placeholder="https://your-epay-domain.com"
      />
      
      <Input
        label="返回地址"
        value={config.returnUrl || ""}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("returnUrl", e.target.value)}
        helperText="支付完成后跳转的地址，例如: https://your-store-domain.com/checkout/success"
        placeholder="https://your-store-domain.com/checkout/success"
      />
      
      <Box display="flex" alignItems="center" gap={2}>
        <input
          type="checkbox"
          id="enabled"
          checked={config.enabled}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("enabled", e.target.checked)}
        />
        <label htmlFor="enabled">启用此支付配置</label>
      </Box>
      
      {testResult && (
        <Box 
          padding={2} 
          borderRadius={4}
          backgroundColor={testResult.success ? "success1" : "critical1"}
        >
          <Text color={testResult.success ? "buttonDefaultPrimary" : "critical1"}>
            {testResult.message}
          </Text>
        </Box>
      )}
      
      <Box display="flex" gap={2}>
        <Button onClick={() => void handleTestConnection()} disabled={isTesting}>
          {isTesting ? "测试中..." : "测试连接"}
        </Button>
        <Button onClick={handleSubmit}>保存配置</Button>
        <Button onClick={onCancel} variant="secondary">
          取消
        </Button>
      </Box>
      
      <Box marginTop={4} padding={3} backgroundColor="default1" borderRadius={4}>
        <h3>配置说明</h3>
        <ul>
          <li>商户ID和密钥请在彩虹易支付商户后台获取</li>
          <li>API地址请使用您的彩虹易支付服务提供商提供的地址</li>
          <li>返回地址是支付完成后跳转的页面地址</li>
          <li>保存配置后，可以在Saleor后台为销售渠道启用此支付方式</li>
          <li>建议在保存前先点击&quot;测试连接&quot;验证配置是否正确</li>
          <li>支付方式支持自定义，具体类型请参考您在易支付平台配置的插件</li>
        </ul>
      </Box>
    </Box>
  );
};