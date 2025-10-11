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

interface SiteStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  suspended: number;
}

export function SiteManager() {
  const [sites, setSites] = useState<Site[]>([]);
  const [stats, setStats] = useState<SiteStats>({ total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchSites = async () => {
    setLoading(true);
    try {
      const url = statusFilter === "all" ? "/api/admin/sites" : `/api/admin/sites?status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json() as { sites?: Site[], stats?: SiteStats };
      setSites(data.sites || []);
      setStats(data.stats || { total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 });
    } catch (error) {
      console.error("Failed to fetch sites:", error);
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
        await fetchSites();
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

  const handleValidateSite = async (siteId: string) => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/validate-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });

      if (res.ok) {
        const result = await res.json() as {
          domain: string;
          saleorApiUrl: string;
          validation: {
            isValid: boolean;
            error?: string;
            shopName?: string;
            version?: string;
          };
          domainMatch: boolean;
          overall: boolean;
        };

        const { validation, domainMatch, overall } = result;
        let message = `验证结果:\n`;
        message += `域名: ${result.domain}\n`;
        message += `Saleor URL: ${result.saleorApiUrl}\n\n`;
        message += `URL验证: ${validation.isValid ? "✅ 通过" : "❌ 失败"}\n`;
        if (validation.error) {
          message += `错误: ${validation.error}\n`;
        }
        if (validation.shopName) {
          message += `店铺名称: ${validation.shopName}\n`;
        }
        message += `域名匹配: ${domainMatch ? "✅ 通过" : "❌ 失败"}\n`;
        message += `\n整体结果: ${overall ? "✅ 验证通过" : "❌ 验证失败"}`;
        
        alert(message);
      } else {
        const errorResult = await res.json() as { message?: string };
        alert(`验证失败: ${errorResult.message || "未知错误"}`);
      }
    } catch (error) {
      console.error("Failed to validate site:", error);
      alert("验证请求失败");
    } finally {
      setLoading(false);
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

  // 初始加载
  useEffect(() => {
    void fetchSites();
  }, [statusFilter]);

  return (
    <Box display="flex" flexDirection="column" gap={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Text size={7}>【管理员】站点授权管理</Text>
        <Button type="button" onClick={fetchSites} disabled={loading}>
          {loading ? "加载中..." : "刷新"}
        </Button>
      </Box>

      {/* 统计信息 */}
      <Box display="grid" __gridTemplateColumns="repeat(5, 1fr)" gap={2}>
        <Box padding={3} borderRadius={4} backgroundColor="default2" textAlign="center">
          <Text size={6} fontWeight="bold">{stats.total}</Text>
          <Text size={2} color="default2">总站点</Text>
        </Box>
        <Box padding={3} borderRadius={4} backgroundColor="warning1" textAlign="center">
          <Text size={6} fontWeight="bold">{stats.pending}</Text>
          <Text size={2} color="warning1">待审批</Text>
        </Box>
        <Box padding={3} borderRadius={4} backgroundColor="success1" textAlign="center">
          <Text size={6} fontWeight="bold">{stats.approved}</Text>
          <Text size={2} color="success1">已批准</Text>
        </Box>
        <Box padding={3} borderRadius={4} backgroundColor="critical2" textAlign="center">
          <Text size={6} fontWeight="bold">{stats.rejected}</Text>
          <Text size={2} color="critical1">已拒绝</Text>
        </Box>
        <Box padding={3} borderRadius={4} backgroundColor="default1" textAlign="center">
          <Text size={6} fontWeight="bold">{stats.suspended}</Text>
          <Text size={2} color="default2">已暂停</Text>
        </Box>
      </Box>

      {/* 状态筛选 */}
      <Box>
        <Text size={3}>筛选状态：</Text>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "8px", marginTop: "4px", minWidth: "150px" }}
        >
          <option value="all">全部状态</option>
          <option value="pending">⏳ 待审批</option>
          <option value="approved">✅ 已批准</option>
          <option value="rejected">❌ 已拒绝</option>
          <option value="suspended">⏸️ 已暂停</option>
        </select>
      </Box>

      {/* 站点列表 */}
      <Box display="flex" flexDirection="column" gap={2}>
        {loading && sites.length === 0 ? (
          <Text>加载中...</Text>
        ) : sites.length === 0 ? (
          <Text>暂无站点</Text>
        ) : (
          sites.map((site) => (
            <Box
              key={site.id}
              padding={4}
              borderWidth={1}
              borderStyle="solid"
              borderColor="default1"
              borderRadius={4}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              backgroundColor="default1"
            >
              <Box display="flex" flexDirection="column" gap={1}>
                <Box display="flex" alignItems="center" gap={3}>
                  <Text size={5} fontWeight="bold">{site.domain}</Text>
                  <Text 
                    size={2} 
                    style={{ 
                      color: getStatusColor(site.status),
                      fontWeight: "bold",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      backgroundColor: `${getStatusColor(site.status)}20`
                    }}
                  >
                    {getStatusText(site.status)}
                  </Text>
                </Box>
                
                <Text size={3} color="default1">站点名称: {site.name}</Text>
                <Text size={2} color="default2">API地址: {site.saleorApiUrl}</Text>
                <Text size={2} color="default2">请求时间: {formatDate(site.requestedAt)}</Text>
                
                {site.approvedAt && (
                  <Text size={2} color="default2">
                    审批时间: {formatDate(site.approvedAt)} 
                    {site.approvedBy && ` (审批人: ${site.approvedBy})`}
                  </Text>
                )}
                
                {site.lastActiveAt && (
                  <Text size={2} color="default2">最后活跃: {formatDate(site.lastActiveAt)}</Text>
                )}
                
                {site.notes && (
                  <Text size={2} color="default2" style={{ fontStyle: "italic" }}>
                    备注: {site.notes}
                  </Text>
                )}
              </Box>

              <Box display="flex" gap={2} flexWrap="wrap">
                <Button 
                  type="button" 
                  size="medium"
                  onClick={() => handleValidateSite(site.id)}
                >
                  🔍 验证URL
                </Button>

                {site.status === "pending" && (
                  <>
                    <Button 
                      type="button" 
                      size="medium"
                      onClick={() => {
                        const notes = prompt("审批备注（可选）:");
                        handleSiteAction("approve", site.id, notes || undefined);
                      }}
                    >
                      ✅ 批准
                    </Button>
                    <Button 
                      type="button" 
                      size="medium"
                      variant="primary"
                      onClick={() => {
                        const notes = prompt("拒绝原因:");
                        if (notes) handleSiteAction("reject", site.id, notes);
                      }}
                    >
                      ❌ 拒绝
                    </Button>
                  </>
                )}

                {site.status === "approved" && (
                  <Button 
                    type="button" 
                    size="medium"
                    variant="primary"
                    onClick={() => {
                      const notes = prompt("暂停原因:");
                      if (notes) handleSiteAction("suspend", site.id, notes);
                    }}
                  >
                    ⏸️ 暂停
                  </Button>
                )}

                {site.status === "suspended" && (
                  <Button 
                    type="button" 
                    size="medium"
                    onClick={() => {
                      const notes = prompt("恢复备注（可选）:");
                      handleSiteAction("restore", site.id, notes || undefined);
                    }}
                  >
                    🔄 恢复
                  </Button>
                )}

                {(site.status === "rejected" || site.status === "suspended") && (
                  <Button 
                    type="button" 
                    size="medium"
                    onClick={() => {
                      const notes = prompt("重新批准备注（可选）:");
                      handleSiteAction("approve", site.id, notes || undefined);
                    }}
                  >
                    ✅ 重新批准
                  </Button>
                )}
              </Box>
            </Box>
          ))
        )}
      </Box>

      {sites.length > 0 && (
        <Box 
          padding={3}
          borderRadius={4}
          backgroundColor="default2"
          borderWidth={1}
          borderStyle="solid"
          borderColor="default1"
        >
          <Text size={3} fontWeight="bold">
            💡 站点授权说明
          </Text>
          <Text size={2} color="default2">
            • <strong>待审批</strong>：新站点安装插件后等待管理员审批<br/>
            • <strong>已批准</strong>：站点可以正常使用插件功能<br/>
            • <strong>已拒绝</strong>：站点无法安装或使用插件<br/>
            • <strong>已暂停</strong>：临时停用站点的插件访问权限
          </Text>
        </Box>
      )}
    </Box>
  );
}