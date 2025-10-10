import { Box, Button, Text } from "@saleor/macaw-ui";
import { useState } from "react";

interface PluginAdminLoginProps {
  onLoginSuccess: () => void;
}

export function PluginAdminLogin({ onLoginSuccess }: PluginAdminLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/plugin-admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json() as { message?: string };

      if (res.ok) {
        onLoginSuccess();
      } else {
        setError(data.message || "登录失败");
      }
    } catch (error) {
      console.error("登录错误:", error);
      setError("登录过程中发生错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      style={{ minHeight: "400px" }}
    >
      <Box
        as="form"
        onSubmit={handleSubmit}
        display="flex"
        flexDirection="column"
        gap={4}
        padding={6}
        borderWidth={1}
        borderStyle="solid"
        borderColor="default1"
        borderRadius={4}
        backgroundColor="default2"
        __maxWidth="400px"
        width="100%"
      >
        <Box display="flex" flexDirection="column" gap={2} alignItems="center">
          <Text size={7}>🔐 插件管理员登录</Text>
          <Text size={3} color="default2" textAlign="center">
            此登录独立于Saleor用户系统
            <br />
            用于管理支付渠道配置
          </Text>
        </Box>

        {error && (
          <Box
            padding={3}
            borderRadius={4}
            backgroundColor="critical2"
            borderWidth={1}
            borderStyle="solid"
            borderColor="critical1"
          >
            <Text size={3} color="critical1">
              ❌ {error}
            </Text>
          </Box>
        )}

        <Box display="flex" flexDirection="column" gap={2}>
          <Box>
            <Text size={3}>用户名</Text>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="plugin_admin"
              style={{
                width: "100%",
                padding: "12px",
                marginTop: "4px",
                fontSize: "16px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </Box>

          <Box>
            <Text size={3}>密码</Text>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "12px",
                marginTop: "4px",
                fontSize: "16px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </Box>
        </Box>

        <Button type="submit" disabled={loading}>
          {loading ? "登录中..." : "登录"}
        </Button>

        <Box
          padding={3}
          borderRadius={4}
          backgroundColor="default2"
          borderWidth={1}
          borderStyle="solid"
          borderColor="default1"
        >
          <Text size={2} color="default2">
            💡 提示：账号密码在服务器的 .env 文件中配置
            <br />
            变量名：PLUGIN_ADMIN_USERNAME 和 PLUGIN_ADMIN_PASSWORD
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
