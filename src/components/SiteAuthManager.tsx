import { Box, Button, Text } from "@saleor/macaw-ui";
import { useState, useEffect } from "react";

interface Site {
  id: string;
  domain: string;
  name: string;
  saleorApiUrl: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  notes?: string;
  lastActiveAt?: string;
}

interface AuthData {
  saleorApiUrl: string;
  domain: string;
  appId: string;
  hasToken: boolean;
  hasJwks: boolean;
  siteId?: string;
}

interface SiteAuthOverview {
  site: Site | null;
  authData: AuthData | null;
  isAuthorized: boolean;
  canActivate: boolean;
  needsAuth: boolean;
  isOrphaned?: boolean;
}

interface Stats {
  total: {
    sites: number;
    authData: number;
    authorized: number;
    pending: number;
    orphaned: number;
  };
  sites: {
    pending: number;
    approved: number;
    rejected: number;
    suspended: number;
  };
  auth: {
    linked: number;
    unlinked: number;
    authorized: number;
  };
}

export function SiteAuthManager() {
  const [overview, setOverview] = useState<SiteAuthOverview[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sites-auth-overview");
      const data = await res.json() as {
        overview: SiteAuthOverview[];
        stats: Stats;
      };
      setOverview(data.overview || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error("Failed to fetch sites-auth overview:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSiteAction = async (action: string, siteId: string, notes?: string) => {
    try {
      const res = await fetch(`/api/admin/sites?action=${action}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: siteId, notes }),
      });

      if (res.ok) {
        await fetchOverview();
        const actionNames: Record<string, string> = {
          approve: "批准",
          reject: "拒绝", 
          suspend: "暂停",
          restore: "恢复",
        };
        alert(`站点已${actionNames[action] || action}`);
      }
    } catch (error) {
      console.error(`Failed to ${action} site:`, error);
    }
  };

  const handleAuthAction = async (action: string, saleorApiUrl: string, siteId?: string) => {
    try {
      const res = await fetch(`/api/admin/auth-management?action=${action}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleorApiUrl, siteId }),
      });

      if (res.ok) {
        await fetchOverview();
        const actionNames: Record<string, string> = {
          associate: "关联",
          "approve-site": "批准并激活",
        };
        alert(`认证数据已${actionNames[action] || action}`);
      }
    } catch (error) {
      console.error(`Failed to ${action} auth:`, error);
    }
  };

  const handleDeleteAuth = async (saleorApiUrl: string) => {
    if (!confirm("确定要删除这个认证数据吗？这将导致站点无法使用插件功能。")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/auth-management?saleorApiUrl=${encodeURIComponent(saleorApiUrl)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchOverview();
        alert("认证数据已删除");
      }
    } catch (error) {
      console.error("Failed to delete auth:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "#22c55e";
      case "pending": return "#f59e0b";
      case "rejected": return "#ef4444";
      case "suspended": return "#6b7280";
      default: return "#6b7280";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "approved": return "✅ 已批准";
      case "pending": return "⏳ 待审批";
      case "rejected": return "❌ 已拒绝";
      case "suspended": return "⏸️ 已暂停";
      default: return status;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("zh-CN");
  };

  const getFilteredOverview = () => {
    if (statusFilter === "all") return overview;
    if (statusFilter === "orphaned") return overview.filter(item => item.isOrphaned);
    if (statusFilter === "needs-auth") return overview.filter(item => item.needsAuth);
    if (statusFilter === "authorized") return overview.filter(item => item.isAuthorized);
    return overview.filter(item => item.site?.status === statusFilter);
  };

  // 初始加载
  useEffect(() => {
    void fetchOverview();
  }, []);

  return (
    <Box display="flex" flexDirection="column" gap={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Text size={7}>【管理员】站点认证管理</Text>
        <Button type="button" onClick={fetchOverview} disabled={loading}>
          {loading ? "加载中..." : "刷新"}
        </Button>
      </Box>

      {/* 统计信息 */}
      {stats && (
        <Box display="grid" __gridTemplateColumns="repeat(5, 1fr)" gap={2}>
          <Box padding={3} borderRadius={4} backgroundColor="default2" textAlign="center">
            <Text size={6} fontWeight="bold">{stats.total.sites}</Text>
            <Text size={2} color="default2">总站点</Text>
          </Box>
          <Box padding={3} borderRadius={4} backgroundColor="info1" textAlign="center">
            <Text size={6} fontWeight="bold">{stats.total.authData}</Text>
            <Text size={2} color="info1">认证数据</Text>
          </Box>
          <Box padding={3} borderRadius={4} backgroundColor="success1" textAlign="center">
            <Text size={6} fontWeight="bold">{stats.total.authorized}</Text>
            <Text size={2} color="success1">已授权</Text>
          </Box>
          <Box padding={3} borderRadius={4} backgroundColor="warning1" textAlign="center">
            <Text size={6} fontWeight="bold">{stats.total.pending}</Text>
            <Text size={2} color="warning1">待激活</Text>
          </Box>
          <Box padding={3} borderRadius={4} backgroundColor="critical2" textAlign="center">
            <Text size={6} fontWeight="bold">{stats.total.orphaned}</Text>
            <Text size={2} color="critical1">孤儿数据</Text>
          </Box>
        </Box>
      )}

      {/* 详细统计 */}
      {stats && (
        <Box display="grid" __gridTemplateColumns="repeat(3, 1fr)" gap={4}>
          <Box padding={3} borderRadius={4} backgroundColor="default1">
            <Text size={4} fontWeight="bold" marginBottom={2}>站点状态</Text>
            <Box display="flex" flexDirection="column" gap={1}>
              <Text size={2}>待审批: {stats.sites.pending}</Text>
              <Text size={2}>已批准: {stats.sites.approved}</Text>
              <Text size={2}>已拒绝: {stats.sites.rejected}</Text>
              <Text size={2}>已暂停: {stats.sites.suspended}</Text>
            </Box>
          </Box>
          <Box padding={3} borderRadius={4} backgroundColor="default1">
            <Text size={4} fontWeight="bold" marginBottom={2}>认证状态</Text>
            <Box display="flex" flexDirection="column" gap={1}>
              <Text size={2}>已关联: {stats.auth.linked}</Text>
              <Text size={2}>未关联: {stats.auth.unlinked}</Text>
              <Text size={2}>已授权: {stats.auth.authorized}</Text>
            </Box>
          </Box>
          <Box padding={3} borderRadius={4} backgroundColor="default1">
            <Text size={4} fontWeight="bold" marginBottom={2}>需要处理</Text>
            <Box display="flex" flexDirection="column" gap={1}>
              <Text size={2}>待审批站点: {stats.sites.pending}</Text>
              <Text size={2}>孤儿认证数据: {stats.total.orphaned}</Text>
              <Text size={2}>需要认证的站点: {overview.filter(item => item.needsAuth).length}</Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* 状态筛选 */}
      <Box>
        <Text size={3}>筛选状态：</Text>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "8px", marginTop: "4px", minWidth: "150px" }}
        >
          <option value="all">全部</option>
          <option value="pending">⏳ 待审批站点</option>
          <option value="approved">✅ 已批准站点</option>
          <option value="rejected">❌ 已拒绝站点</option>
          <option value="suspended">⏸️ 已暂停站点</option>
          <option value="authorized">🔐 已授权</option>
          <option value="needs-auth">🔑 需要认证</option>
          <option value="orphaned">👻 孤儿数据</option>
        </select>
      </Box>

      {/* 站点认证列表 */}
      <Box display="flex" flexDirection="column" gap={2}>
        {loading && overview.length === 0 ? (
          <Text>加载中...</Text>
        ) : getFilteredOverview().length === 0 ? (
          <Text>暂无数据</Text>
        ) : (
          getFilteredOverview().map((item, index) => (
            <Box
              key={item.site?.id || `orphan-${index}`}
              padding={4}
              borderWidth={1}
              borderStyle="solid"
              borderColor={item.isOrphaned ? "critical1" : "default1"}
              borderRadius={4}
              backgroundColor={item.isOrphaned ? "critical1" : item.isAuthorized ? "success1" : "default1"}
              display="flex"
              flexDirection="column"
              gap={3}
            >
              {/* 主要信息行 */}
              <Box display="flex" justifyContent="space-between" alignItems="start">
                <Box display="flex" flexDirection="column" gap={2} style={{ flex: 1 }}>
                  {/* 站点信息 */}
                  {item.site ? (
                    <Box>
                      <Box display="flex" alignItems="center" gap={3} marginBottom={1}>
                        <Text size={5} fontWeight="bold">{item.site.domain}</Text>
                        <Text 
                          size={2} 
                          style={{ 
                            color: getStatusColor(item.site.status),
                            fontWeight: "bold",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            backgroundColor: `${getStatusColor(item.site.status)}20`
                          }}
                        >
                          {getStatusText(item.site.status)}
                        </Text>
                        {item.isAuthorized && (
                          <Text size={2} style={{ color: "#22c55e", fontWeight: "bold" }}>
                            🔐 已授权使用
                          </Text>
                        )}
                      </Box>
                      <Text size={3} color="default1">站点名称: {item.site.name}</Text>
                      <Text size={2} color="default2">API地址: {item.site.saleorApiUrl}</Text>
                      <Text size={2} color="default2">请求时间: {formatDate(item.site.requestedAt)}</Text>
                      {item.site.notes && (
                        <Text size={2} color="default2" style={{ fontStyle: "italic" }}>
                          备注: {item.site.notes}
                        </Text>
                      )}
                    </Box>
                  ) : (
                    <Box>
                      <Text size={5} fontWeight="bold" color="critical1">
                        👻 孤儿认证数据
                      </Text>
                      <Text size={3} color="default1">域名: {item.authData?.domain}</Text>
                    </Box>
                  )}

                  {/* 认证信息 */}
                  {item.authData ? (
                    <Box padding={2} borderRadius={4} backgroundColor="info1">
                      <Text size={3} fontWeight="bold" marginBottom={1}>🔑 认证数据</Text>
                      <Text size={2}>API URL: {item.authData.saleorApiUrl}</Text>
                      <Text size={2}>App ID: {item.authData.appId}</Text>
                      <Text size={2}>Token: {item.authData.hasToken ? "✅ 已配置" : "❌ 缺失"}</Text>
                      <Text size={2}>JWKS: {item.authData.hasJwks ? "✅ 已配置" : "❌ 缺失"}</Text>
                      <Text size={2}>关联状态: {item.authData.siteId ? `✅ 已关联 (${item.authData.siteId})` : "❌ 未关联"}</Text>
                    </Box>
                  ) : (
                    <Box padding={2} borderRadius={4} backgroundColor="warning1">
                      <Text size={3} fontWeight="bold">⚠️ 缺少认证数据</Text>
                      <Text size={2}>该站点尚未安装插件或认证数据丢失</Text>
                    </Box>
                  )}
                </Box>

                {/* 操作按钮 */}
                <Box display="flex" flexDirection="column" gap={2} style={{ minWidth: "200px" }}>
                  {/* 站点操作 */}
                  {item.site && (
                    <Box>
                      <Text size={2} fontWeight="bold" marginBottom={1}>站点操作</Text>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {item.site.status === "pending" && (
                          <>
                            <Button 
                              type="button" 
                              size="small"
                              onClick={() => {
                                const notes = prompt("审批备注（可选）:");
                                handleSiteAction("approve", item.site!.id, notes || undefined);
                              }}
                            >
                              ✅ 批准
                            </Button>
                            <Button 
                              type="button" 
                              size="small"
                              variant="primary"
                              onClick={() => {
                                const notes = prompt("拒绝原因:");
                                if (notes) handleSiteAction("reject", item.site!.id, notes);
                              }}
                            >
                              ❌ 拒绝
                            </Button>
                          </>
                        )}

                        {item.site.status === "approved" && (
                          <Button 
                            type="button" 
                            size="small"
                            variant="primary"
                            onClick={() => {
                              const notes = prompt("暂停原因:");
                              if (notes) handleSiteAction("suspend", item.site!.id, notes);
                            }}
                          >
                            ⏸️ 暂停
                          </Button>
                        )}

                        {(item.site.status === "suspended" || item.site.status === "rejected") && (
                          <Button 
                            type="button" 
                            size="small"
                            onClick={() => {
                              const notes = prompt("恢复备注（可选）:");
                              handleSiteAction("restore", item.site!.id, notes || undefined);
                            }}
                          >
                            🔄 恢复
                          </Button>
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* 认证操作 */}
                  {item.authData && (
                    <Box>
                      <Text size={2} fontWeight="bold" marginBottom={1}>认证操作</Text>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {!item.authData.siteId && item.site && (
                          <Button 
                            type="button" 
                            size="small"
                            onClick={() => handleAuthAction("associate", item.authData!.saleorApiUrl, item.site!.id)}
                          >
                            🔗 关联站点
                          </Button>
                        )}

                        {item.site?.status === "pending" && item.authData && (
                          <Button 
                            type="button" 
                            size="small"
                            onClick={() => handleAuthAction("approve-site", item.authData!.saleorApiUrl, item.site!.id)}
                          >
                            🚀 批准并激活
                          </Button>
                        )}

                        <Button 
                          type="button" 
                          size="small"
                          variant="primary"
                          onClick={() => handleDeleteAuth(item.authData!.saleorApiUrl)}
                        >
                          🗑️ 删除认证
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          ))
        )}
      </Box>

      {/* 说明信息 */}
      <Box 
        padding={4}
        borderRadius={4}
        backgroundColor="default2"
        borderWidth={1}
        borderStyle="solid"
        borderColor="default1"
      >
        <Text size={3} fontWeight="bold" marginBottom={2}>
          💡 站点认证管理说明
        </Text>
        <Box display="grid" __gridTemplateColumns="repeat(2, 1fr)" gap={4}>
          <Box>
            <Text size={2} color="default2">
              <strong>站点状态：</strong><br/>
              • <strong>待审批</strong>：新站点等待管理员审批<br/>
              • <strong>已批准</strong>：站点可以正常使用插件<br/>
              • <strong>已拒绝/暂停</strong>：站点无法使用插件功能
            </Text>
          </Box>
          <Box>
            <Text size={2} color="default2">
              <strong>认证数据：</strong><br/>
              • <strong>已关联</strong>：认证数据与站点正确关联<br/>
              • <strong>孤儿数据</strong>：认证数据没有对应的站点<br/>
              • <strong>已授权</strong>：站点已批准且有有效认证数据
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default SiteAuthManager;