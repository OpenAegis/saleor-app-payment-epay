import { Box, Button, Text } from "@saleor/macaw-ui";
import { useState, useEffect } from "react";
import type { Channel } from "../lib/models/channel";

interface ChannelManagerProps {
  onChannelSelect: (channel: Channel) => void;
}

export function ChannelManager({ onChannelSelect }: ChannelManagerProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "alipay",
    icon: "",
    priority: 0,
  });

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/channels");
      const data = await res.json() as { channels?: Channel[] };
      setChannels(data.channels || []);
    } catch (error) {
      console.error("Failed to fetch channels:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/admin/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setFormData({
          name: "",
          description: "",
          type: "alipay",
          icon: "",
          priority: 0,
        });
        setShowForm(false);
        await fetchChannels();
      }
    } catch (error) {
      console.error("Failed to create channel:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除此渠道吗？这将同时删除该渠道下的所有通道。")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/channels?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchChannels();
      }
    } catch (error) {
      console.error("Failed to delete channel:", error);
    }
  };

  // 初始加载
  useEffect(() => {
    void fetchChannels();
  }, []);

  return (
    <Box display="flex" flexDirection="column" gap={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Text size={7}>【管理员】渠道管理</Text>
        <Button type="button" onClick={() => setShowForm(!showForm)}>
          {showForm ? "取消" : "添加渠道"}
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
                placeholder="例如：支付宝通道"
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
                <option value="alipay">支付宝</option>
                <option value="wxpay">微信支付</option>
                <option value="qqpay">QQ钱包</option>
                <option value="bank">云闪付</option>
                <option value="jdpay">京东支付</option>
                <option value="paypal">PayPal</option>
              </select>
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

          <Box>
            <Text size={3}>描述</Text>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="通道描述信息"
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
        {loading && channels.length === 0 ? (
          <Text>加载中...</Text>
        ) : channels.length === 0 ? (
          <Text>暂无渠道，请先添加</Text>
        ) : (
          channels.map((channel) => (
            <Box
              key={channel.id}
              padding={4}
              borderWidth={1}
              borderStyle="solid"
              borderColor="default1"
              borderRadius={4}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              backgroundColor="default1"
              __opacity={channel.enabled ? 1 : 0.6}
            >
              <Box display="flex" alignItems="center" gap={3}>
                {channel.icon && (
                  <img
                    src={channel.icon}
                    alt={channel.name}
                    style={{ width: "32px", height: "32px", borderRadius: "4px" }}
                  />
                )}
                <Box>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Text size={5}>{channel.name}</Text>
                    <Text size={2} color="default2">
                      优先级: {channel.priority}
                    </Text>
                  </Box>
                  {channel.description && (
                    <Text size={3} color="default1">
                      {channel.description}
                    </Text>
                  )}
                </Box>
              </Box>
              <Box display="flex" gap={2}>
                <Button type="button" size="medium" onClick={() => onChannelSelect(channel)}>
                  管理通道
                </Button>
                <Button
                  type="button"
                  size="medium"
                  variant="primary"
                  onClick={() => handleDelete(channel.id)}
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

export default ChannelManager;