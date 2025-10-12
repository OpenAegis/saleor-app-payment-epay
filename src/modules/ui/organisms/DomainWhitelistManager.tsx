import React, { useState, useEffect } from "react";
import { Box, Button, Input, Text } from "@saleor/macaw-ui";

// 定义API响应类型
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface DomainWhitelistItem {
  id: string;
  domainPattern: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const logger = {
  error: (message: string, meta?: unknown) => console.error(message, meta),
};

export const DomainWhitelistManager: React.FC = () => {
  const [whitelist, setWhitelist] = useState<DomainWhitelistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState({
    domainPattern: "",
    description: "",
    isActive: true,
  });

  // 获取域名白名单
  const fetchWhitelist = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/domain-whitelist");
      const result = (await response.json()) as ApiResponse<DomainWhitelistItem[]>;

      if (result.success && result.data) {
        setWhitelist(result.data);
        setError(null);
      } else {
        setError(result.error || "获取白名单失败");
      }
    } catch (err: unknown) {
      logger.error("获取白名单时发生错误", { error: err });
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // 添加新域名到白名单
  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newDomain.domainPattern) {
      setError("域名模式是必填项");
      return;
    }

    try {
      const response = await fetch("/api/domain-whitelist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newDomain),
      });

      const result = (await response.json()) as ApiResponse<DomainWhitelistItem>;

      if (result.success) {
        setNewDomain({
          domainPattern: "",
          description: "",
          isActive: true,
        });
        setError(null);
        void fetchWhitelist(); // 重新获取列表
      } else {
        setError(result.error || "添加失败");
      }
    } catch (err: unknown) {
      logger.error("添加域名时发生错误", { error: err });
      setError("网络错误，请稍后重试");
    }
  };

  // 更新域名状态
  const handleUpdateDomain = async (id: string, updates: Partial<DomainWhitelistItem>) => {
    try {
      const response = await fetch(`/api/domain-whitelist?id=${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      const result = (await response.json()) as ApiResponse<DomainWhitelistItem>;

      if (result.success) {
        setError(null);
        void fetchWhitelist(); // 重新获取列表
      } else {
        setError(result.error || "更新失败");
      }
    } catch (err: unknown) {
      logger.error("更新域名时发生错误", { error: err });
      setError("网络错误，请稍后重试");
    }
  };

  // 删除域名
  const handleDeleteDomain = async (id: string) => {
    if (!confirm("确定要删除这个域名吗？")) {
      return;
    }

    try {
      const response = await fetch(`/api/domain-whitelist?id=${id}`, {
        method: "DELETE",
      });

      const result = (await response.json()) as ApiResponse<null>;

      if (result.success) {
        setError(null);
        void fetchWhitelist(); // 重新获取列表
      } else {
        setError(result.error || "删除失败");
      }
    } catch (err: unknown) {
      logger.error("删除域名时发生错误", { error: err });
      setError("网络错误，请稍后重试");
    }
  };

  // 批准域名
  const handleApproveDomain = async (id: string) => {
    try {
      const response = await fetch(`/api/domain-whitelist?action=approve&id=${id}`, {
        method: "POST",
      });

      const result = (await response.json()) as ApiResponse<DomainWhitelistItem>;

      if (result.success) {
        setError(null);
        void fetchWhitelist(); // 重新获取列表
      } else {
        setError(result.error || "批准失败");
      }
    } catch (err: unknown) {
      logger.error("批准域名时发生错误", { error: err });
      setError("网络错误，请稍后重试");
    }
  };

  // 拒绝域名
  const handleRejectDomain = async (id: string) => {
    if (!confirm("确定要拒绝并删除这个域名吗？")) {
      return;
    }

    try {
      const response = await fetch(`/api/domain-whitelist?action=reject&id=${id}`, {
        method: "POST",
      });

      const result = (await response.json()) as ApiResponse<null>;

      if (result.success) {
        setError(null);
        void fetchWhitelist(); // 重新获取列表
      } else {
        setError(result.error || "拒绝失败");
      }
    } catch (err: unknown) {
      logger.error("拒绝域名时发生错误", { error: err });
      setError("网络错误，请稍后重试");
    }
  };

  useEffect(() => {
    void fetchWhitelist();
  }, []);

  if (loading) {
    return <Box padding={4}>加载中...</Box>;
  }

  return (
    <Box display="flex" flexDirection="column" gap={6}>
      <Box borderWidth={1} borderStyle="solid" borderColor="default1" padding={4} borderRadius={2}>
        <h2 style={{ marginBottom: "16px" }}>添加域名到白名单</h2>
        <form
          onSubmit={(e) => {
            void handleAddDomain(e);
          }}
          method="post"
        >
          <Box display="flex" flexDirection="column" gap={4}>
            <Box>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
                域名模式
              </label>
              <Input
                value={newDomain.domainPattern}
                onChange={(e) => setNewDomain({ ...newDomain, domainPattern: e.target.value })}
                placeholder="例如: example.com 或使用正则表达式 .*\.example\.com"
                required
              />
            </Box>

            <Box>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
                描述
              </label>
              <Input
                value={newDomain.description}
                onChange={(e) => setNewDomain({ ...newDomain, description: e.target.value })}
                placeholder="描述这个域名的用途"
              />
            </Box>

            <Box display="flex" alignItems="center">
              <input
                type="checkbox"
                checked={newDomain.isActive}
                onChange={(e) => setNewDomain({ ...newDomain, isActive: e.target.checked })}
                id="isActive"
              />
              <label htmlFor="isActive" style={{ marginLeft: "8px" }}>
                激活
              </label>
            </Box>

            <Button type="submit">添加域名</Button>
          </Box>
        </form>
      </Box>

      {error && (
        <Box
          backgroundColor="critical1"
          borderColor="critical1"
          borderWidth={1}
          borderStyle="solid"
          padding={3}
          borderRadius={2}
        >
          <Text color="default1">{error}</Text>
        </Box>
      )}

      <Box borderWidth={1} borderStyle="solid" borderColor="default1" padding={4} borderRadius={2}>
        <h2 style={{ marginBottom: "16px" }}>域名白名单</h2>
        {whitelist.length === 0 ? (
          <p>暂无域名白名单配置</p>
        ) : (
          <Box overflowX="auto">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb" }}>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "#6b7280",
                      textTransform: "uppercase",
                    }}
                  >
                    域名模式
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "#6b7280",
                      textTransform: "uppercase",
                    }}
                  >
                    描述
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "#6b7280",
                      textTransform: "uppercase",
                    }}
                  >
                    状态
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "#6b7280",
                      textTransform: "uppercase",
                    }}
                  >
                    创建时间
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "#6b7280",
                      textTransform: "uppercase",
                    }}
                  >
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {whitelist.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td
                      style={{
                        padding: "12px",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#111827",
                      }}
                    >
                      {item.domainPattern}
                    </td>
                    <td style={{ padding: "12px", fontSize: "14px", color: "#6b7280" }}>
                      {item.description || "-"}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          fontSize: "12px",
                          fontWeight: "500",
                          borderRadius: "9999px",
                          backgroundColor: item.isActive ? "#dcfce7" : "#fef9c3",
                          color: item.isActive ? "#166534" : "#854d0e",
                        }}
                      >
                        {item.isActive ? "已激活" : "待审核"}
                      </span>
                    </td>
                    <td style={{ padding: "12px", fontSize: "14px", color: "#6b7280" }}>
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "12px" }}>
                      {!item.isActive ? (
                        <Box display="flex" gap={2}>
                          <Button
                            variant="primary"
                            size="small"
                            onClick={() => {
                              void handleApproveDomain(item.id);
                            }}
                          >
                            批准
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => {
                              void handleRejectDomain(item.id);
                            }}
                          >
                            拒绝
                          </Button>
                        </Box>
                      ) : (
                        <Box display="flex" gap={2}>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => {
                              void handleUpdateDomain(item.id, { isActive: false });
                            }}
                          >
                            禁用
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => {
                              void handleDeleteDomain(item.id);
                            }}
                          >
                            删除
                          </Button>
                        </Box>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        )}
      </Box>
    </Box>
  );
};
