import { Box, Button, Text } from "@saleor/macaw-ui";
import { useState, useEffect } from "react";

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

interface Channel {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
  icon?: string;
}

export function UserGatewayConfig() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchChannelsAndGateways = async () => {
    setLoading(true);
    try {
      // 获取所有渠道
      const channelsRes = await fetch("/api/channels");
      const channelsData = await channelsRes.json() as { channels?: Channel[] };
      setChannels(channelsData.channels || []);

      // 获取所有通道
      const gatewaysRes = await fetch("/api/gateways");
      const gatewaysData = await gatewaysRes.json() as { gateways?: Gateway[] };
      setGateways(gatewaysData.gateways || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGateway = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/gateways/${id}/toggle`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (res.ok) {
        // 更新本地状态
        setGateways(prev => 
          prev.map(gateway => 
            gateway.id === id ? { ...gateway, enabled } : gateway
          )
        );
      }
    } catch (error) {
      console.error("Failed to toggle gateway:", error);
    }
  };

  useEffect(() => {
    void fetchChannelsAndGateways();
  }, []);

  // 按渠道分组通道
  const gatewaysByChannel = channels.reduce((acc, channel) => {
    const channelGateways = gateways.filter(g => g.channelId === channel.id);
    if (channelGateways.length > 0) {
      acc[channel.id] = {
        channel,
        gateways: channelGateways.sort((a, b) => a.priority - b.priority),
      };
    }
    return acc;
  }, {} as Record<string, { channel: Channel; gateways: Gateway[] }>);

  if (loading) {
    return (
      <Box padding={6}>
        <Text>加载中...</Text>
      </Box>
    );
  }

  return (
    <Box display="flex" flexDirection="column" gap={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Text size={7}>支付通道配置</Text>
        <Button type="button" onClick={fetchChannelsAndGateways}>
          刷新
        </Button>
      </Box>

      <Box
        padding={3}
        borderRadius={4}
        backgroundColor="accent1"
        borderWidth={1}
        borderStyle="solid"
        borderColor="accent1"
      >
        <Text size={3} fontWeight="bold">
          💡 用户权限说明
        </Text>
        <Text size={2} color="default2">
          作为普通Saleor管理员，你只能启用/禁用已配置的支付通道。如需添加、编辑或删除通道，请联系插件管理员。
        </Text>
      </Box>

      {Object.keys(gatewaysByChannel).length === 0 ? (
        <Box
          padding={6}
          borderRadius={4}
          backgroundColor="default2"
          textAlign="center"
        >
          <Text size={5}>暂无可用的支付通道</Text>
          <Text size={3} color="default2">
            请联系插件管理员配置支付渠道和通道
          </Text>
        </Box>
      ) : (
        Object.values(gatewaysByChannel).map(({ channel, gateways: channelGateways }) => (
          <Box
            key={channel.id}
            padding={4}
            borderWidth={1}
            borderStyle="solid"
            borderColor="default1"
            borderRadius={4}
            backgroundColor="default1"
          >
            <Box display="flex" alignItems="center" gap={3} marginBottom={3}>
              {channel.icon && (
                <img
                  src={channel.icon}
                  alt={channel.name}
                  style={{ width: "32px", height: "32px", borderRadius: "4px" }}
                />
              )}
              <Box>
                <Text size={6} fontWeight="bold">{channel.name}</Text>
                {channel.description && (
                  <Text size={3} color="default1">
                    {channel.description}
                  </Text>
                )}
              </Box>
            </Box>

            <Box display="flex" flexDirection="column" gap={2}>
              {channelGateways.map((gateway) => (
                <Box
                  key={gateway.id}
                  padding={3}
                  borderRadius={4}
                  backgroundColor="default2"
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  __opacity={gateway.enabled ? 1 : 0.6}
                >
                  <Box display="flex" alignItems="center" gap={3}>
                    {gateway.icon && (
                      <img
                        src={gateway.icon}
                        alt={gateway.name}
                        style={{ width: "24px", height: "24px", borderRadius: "4px" }}
                      />
                    )}
                    <Box>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Text size={4} fontWeight="bold">{gateway.name}</Text>
                        <Text size={2} color="default2">
                          {gateway.type}
                        </Text>
                        <Text size={2} color={gateway.enabled ? "success1" : "critical1"}>
                          {gateway.enabled ? "✅ 已启用" : "❌ 已禁用"}
                        </Text>
                      </Box>
                      {gateway.description && (
                        <Text size={2} color="default1">
                          {gateway.description}
                        </Text>
                      )}
                    </Box>
                  </Box>
                  <Button
                    type="button"
                    size="medium"
                    variant={gateway.enabled ? "primary" : "secondary"}
                    onClick={() => handleToggleGateway(gateway.id, !gateway.enabled)}
                  >
                    {gateway.enabled ? "禁用" : "启用"}
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>
        ))
      )}

      <Box
        padding={3}
        borderRadius={4}
        backgroundColor="default2"
        borderWidth={1}
        borderStyle="solid"
        borderColor="default1"
      >
        <Text size={3} fontWeight="bold">
          📋 支付通道状态说明
        </Text>
        <Text size={2} color="default2">
          • <strong>已启用</strong>：通道可在结账时显示给客户选择<br/>
          • <strong>已禁用</strong>：通道不会在结账时显示<br/>
          • 通道按优先级顺序排列，数字越小优先级越高
        </Text>
      </Box>
    </Box>
  );
}