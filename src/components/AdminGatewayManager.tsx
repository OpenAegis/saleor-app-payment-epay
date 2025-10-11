import { Box, Button, Text } from "@saleor/macaw-ui";
import { useState, useEffect } from "react";
import type { Channel } from "../lib/models/channel";

interface Gateway {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  channelId: string;
  priority: number;
  description?: string;
  icon?: string;
}

interface AdminGatewayManagerProps {
  channel: Channel;
  onBack: () => void;
}

export function AdminGatewayManager({ channel, onBack }: AdminGatewayManagerProps) {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    description: "",
    icon: "",
    priority: 0,
  });

  const fetchGateways = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/gateways?channelId=${channel.id}`);
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
        body: JSON.stringify({
          ...formData,
          channelId: channel.id,
        }),
      });

      if (res.ok) {
        setFormData({
          name: "",
          type: "",
          description: "",
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

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/admin/gateways?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (res.ok) {
        await fetchGateways();
      }
    } catch (error) {
      console.error("Failed to toggle gateway:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除此通道吗？")) {
      return;
    }

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
  }, [channel.id]);

  return (
    <Box display="flex" flexDirection="column" gap={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Button type="button" onClick={onBack}>
            ← 返回渠道列表
          </Button>
          <Text size={7}>【管理员】{channel.name} - 通道管理</Text>
        </Box>
        <Button type="button" onClick={() => setShowForm(!showForm)}>
          {showForm ? "取消" : "添加通道"}
        </Button>
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
          <Text size={5}>添加新通道</Text>
          
          <Box display="grid" __gridTemplateColumns="1fr 1fr" gap={3}>
            <Box>
              <Text size={3}>通道名称 *</Text>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="例如：支付宝扫码"
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              />
            </Box>

            <Box>
              <Text size={3}>支付类型 *</Text>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              >
                <option value="">请选择类型</option>
                <option value="alipay">支付宝</option>
                <option value="wechat">微信支付</option>
                <option value="unionpay">银联支付</option>
                <option value="other">其他</option>
              </select>
            </Box>
          </Box>

          <Box display="grid" __gridTemplateColumns="1fr 1fr" gap={3}>
            <Box>
              <Text size={3}>优先级</Text>
              <input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                min="0"
                style={{ width: "100%", padding: "8px", marginTop: "4px" }}
              />
            </Box>

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
          </Box>

          <Box>
            <Text size={3}>描述</Text>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              style={{ width: "100%", padding: "8px", marginTop: "4px" }}
            />
          </Box>

          <Box display="flex" gap={2}>
            <Button type="submit" disabled={loading}>
              {loading ? "创建中..." : "创建通道"}
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
          <Text>暂无通道，请先添加</Text>
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
                    <Text size={5}>{gateway.name}</Text>
                    <Text size={2} color="default2">
                      {gateway.type} | 优先级: {gateway.priority}
                    </Text>
                    <Text size={2} color={gateway.enabled ? "success1" : "critical1"}>
                      {gateway.enabled ? "✅ 已启用" : "❌ 已禁用"}
                    </Text>
                  </Box>
                  {gateway.description && (
                    <Text size={3} color="default1">
                      {gateway.description}
                    </Text>
                  )}
                </Box>
              </Box>
              <Box display="flex" gap={2}>
                <Button
                  type="button"
                  size="medium"
                  onClick={() => handleToggle(gateway.id, !gateway.enabled)}
                >
                  {gateway.enabled ? "禁用" : "启用"}
                </Button>
                <Button
                  type="button"
                  size="medium"
                  variant="primary"
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