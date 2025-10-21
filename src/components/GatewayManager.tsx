import { Box, Button, Text } from "@saleor/macaw-ui";
import { useState, useEffect } from "react";
import type { Gateway } from "../lib/models/gateway";

export function GatewayManager() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    epayUrl: "",
    epayPid: "",
    epayKey: "",
    apiVersion: "v1" as "v1" | "v2",
    signType: "MD5" as "MD5" | "RSA",
    icon: "",
    priority: 0,
  });

  const fetchGateways = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gateways");
      const data = await res.json() as { gateways?: Gateway[] };
      setGateways(data.gateways || []);
    } catch (error) {
      console.error("Failed to fetch gateways:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/admin/gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setFormData({
          name: "",
          description: "",
          epayUrl: "",
          epayPid: "",
          epayKey: "",
          apiVersion: "v1" as "v1" | "v2",
          signType: "MD5" as "MD5" | "RSA",
          icon: "",
          priority: 0,
        });
        setShowForm(false);
        await fetchGateways();
      }
    } catch (error) {
      console.error("Failed to create gateway:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个渠道吗？")) return;

    try {
      const res = await fetch(`/api/admin/gateways?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchGateways();
      }
    } catch (error) {
      console.error("Failed to delete gateway:", error);
    }
  };

  useEffect(() => {
    void fetchGateways();
  }, []);

  const getPaymentTypeName = (type: string) => {
    const names: Record<string, string> = {
      alipay: "支付宝",
      wxpay: "微信支付",
      qqpay: "QQ钱包",
      bank: "云闪付",
      jdpay: "京东支付",
      paypal: "PayPal",
    };
    return names[type] || type;
  };

  return (
    <Box display="flex" flexDirection="column" gap={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Text size={6} fontWeight="bold">
            渠道管理
          </Text>
          <Text size={3} color="default1">
            管理易支付渠道配置（API地址、商户ID、密钥等）
          </Text>
        </Box>
        <Box display="flex" gap={2}>
          <Button onClick={() => setShowForm(true)} disabled={loading}>
            添加渠道
          </Button>
        </Box>
      </Box>

      {showForm && (
        <Box
          as="form"
          onSubmit={handleSubmit}
          display="flex"
          flexDirection="column"
          gap={3}
          padding={4}
          borderWidth={1}
          borderStyle="solid"
          borderColor="default1"
          borderRadius={4}
          backgroundColor="default2"
        >
          <Text size={5}>添加新渠道</Text>
          
          <Box display="grid" __gridTemplateColumns="1fr 1fr" gap={3}>
            <Box>
              <Text size={3}>渠道名称 *</Text>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="例如：易支付主渠道"
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              />
            </Box>

            <Box>
              <Text size={3}>优先级</Text>
              <input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                min="0"
                placeholder="0"
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              />
            </Box>
          </Box>

          <Box display="grid" __gridTemplateColumns="1fr 1fr" gap={3}>
            <Box>
              <Text size={3}>易支付API地址 *</Text>
              <input
                type="url"
                value={formData.epayUrl}
                onChange={(e) => setFormData({ ...formData, epayUrl: e.target.value })}
                required
                placeholder="https://pay.example.com/api"
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              />
            </Box>

            <Box>
              <Text size={3}>易支付商户ID *</Text>
              <input
                type="text"
                value={formData.epayPid}
                onChange={(e) => setFormData({ ...formData, epayPid: e.target.value })}
                required
                placeholder="商户ID"
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              />
            </Box>
          </Box>

          <Box>
            <Text size={3}>易支付密钥 *</Text>
            <input
              type="password"
              value={formData.epayKey}
              onChange={(e) => setFormData({ ...formData, epayKey: e.target.value })}
              required
              placeholder="易支付密钥"
              style={{ width: "100%", padding: "8px", marginTop: "4px" }}
            />
          </Box>

          <Box display="grid" __gridTemplateColumns="1fr 1fr" gap={3}>
            <Box>
              <Text size={3}>API 版本 *</Text>
              <select
                value={formData.apiVersion}
                onChange={(e) => {
                  const apiVersion = e.target.value as "v1" | "v2";
                  setFormData({ 
                    ...formData, 
                    apiVersion,
                    signType: apiVersion === "v2" ? "RSA" : "MD5" // v2 默认使用 RSA
                  });
                }}
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              >
                <option value="v1">v1 (兼容模式 - /mapi.php)</option>
                <option value="v2">v2 (现代模式 - /api/pay/create)</option>
              </select>
              <Text size={2} color="default2" marginTop={1}>
                {formData.apiVersion === "v1" 
                  ? "使用传统 v1 API，兼容性好" 
                  : "使用现代 v2 API，支持更多功能"}
              </Text>
            </Box>

            <Box>
              <Text size={3}>签名类型 *</Text>
              <select
                value={formData.signType}
                onChange={(e) => setFormData({ ...formData, signType: e.target.value as "MD5" | "RSA" })}
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              >
                <option value="MD5">MD5 签名</option>
                <option value="RSA">RSA 签名</option>
              </select>
              <Text size={2} color="default2" marginTop={1}>
                {formData.signType === "MD5" 
                  ? "MD5 签名，适用于 v1 API" 
                  : "RSA 签名，推荐用于 v2 API"}
              </Text>
            </Box>
          </Box>

          <Box display="grid" __gridTemplateColumns="1fr 1fr" gap={3}>
            <Box>
              <Text size={3}>图标URL</Text>
              <input
                type="url"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="https://example.com/icon.png"
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              />
            </Box>

            <Box>
              <Text size={3}>描述</Text>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="渠道描述"
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              />
            </Box>
          </Box>

          <Box display="flex" gap={2}>
            <Button type="submit" disabled={loading}>
              {loading ? "创建中..." : "创建渠道"}
            </Button>
            <Button type="button" onClick={() => setShowForm(false)}>
              取消
            </Button>
          </Box>
        </Box>
      )}

      <Box display="flex" flexDirection="column" gap={2}>
        {loading && gateways.length === 0 ? (
          <Text>加载中...</Text>
        ) : gateways.length === 0 ? (
          <Text>暂无渠道，请先添加</Text>
        ) : (
          gateways.map((gateway) => (
            <Box
              key={gateway.id}
              padding={4}
              borderWidth={1}
              borderStyle="solid"
              borderColor="default1"
              borderRadius={4}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              backgroundColor="default1"
              __opacity={gateway.enabled ? 1 : 0.6}
            >
              <Box display="flex" flexDirection="column" gap={1}>
                <Box display="flex" alignItems="center" gap={3}>
                  {gateway.icon && (
                    <img
                      src={gateway.icon}
                      alt={gateway.name}
                      style={{ width: "32px", height: "32px", borderRadius: "4px" }}
                    />
                  )}
                  <Box>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Text size={5} fontWeight="bold">{gateway.name}</Text>
                      <Box 
                        display="inline-flex" 
                        alignItems="center" 
                        padding={1} 
                        backgroundColor={gateway.apiVersion === "v2" ? "success1" : "warning1"}
                        borderRadius={2}
                      >
                        <Text size={1} fontWeight="bold" color="default2">
                          {gateway.apiVersion?.toUpperCase() || "V1"} / {gateway.signType || "MD5"}
                        </Text>
                      </Box>
                    </Box>
                    <Text size={3} color="default1">
                      API: {gateway.epayUrl}
                    </Text>
                    <Text size={3} color="default1">
                      商户ID: {gateway.epayPid}
                    </Text>
                    <Text size={2} color="default2">
                      API版本: {gateway.apiVersion === "v2" ? "v2 (现代模式)" : "v1 (兼容模式)"} | 
                      签名: {gateway.signType || "MD5"}
                    </Text>
                    {gateway.description && (
                      <Text size={2} color="default2">{gateway.description}</Text>
                    )}
                  </Box>
                </Box>
              </Box>

              <Box display="flex" gap={2}>
                <Button
                  variant={gateway.enabled ? "primary" : "secondary"}
                  size="small"
                >
                  {gateway.enabled ? "已启用" : "已禁用"}
                </Button>
                <Button
                  variant="tertiary"
                  size="small"
                  onClick={() => handleDelete(gateway.id)}
                >
                  删除
                </Button>
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

export default GatewayManager;