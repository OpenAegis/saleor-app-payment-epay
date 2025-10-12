import React, { useState } from "react";
import { useRouter } from "next/router";
import { Button, Box, Text, Input } from "@saleor/macaw-ui";

interface LoginForm {
  username: string;
  password: string;
}

export default function AdminLogin() {
  const router = useRouter();
  const [form, setForm] = useState<LoginForm>({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/plugin-admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json() as { message?: string };

      if (response.ok) {
        // 登录成功，跳转到管理后台
        router.push("/admin/dashboard");
      } else {
        setError(data.message || "登录失败");
      }
    } catch (error) {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof LoginForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <Box 
      display="flex" 
      justifyContent="center" 
      alignItems="center" 
      style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}
    >
      <Box 
        padding={8} 
        borderWidth={1} 
        borderStyle="solid" 
        borderColor="default1" 
        borderRadius={4} 
        backgroundColor="default1"
        style={{ width: "100%", maxWidth: "400px" }}
      >
        <Box marginBottom={6} textAlign="center">
          <Text size={7} fontWeight="bold" marginBottom={2}>插件管理后台</Text>
          <Text size={3} color="default1">请输入管理员账户信息登录</Text>
        </Box>
        
        <form onSubmit={handleSubmit}>
          <Box display="flex" flexDirection="column" gap={4}>
            <Box>
              <Text size={3} marginBottom={2}>用户名</Text>
              <Input
                type="text"
                value={form.username}
                onChange={handleChange("username")}
                placeholder="请输入用户名"
                required
                disabled={loading}
              />
            </Box>
            
            <Box>
              <Text size={3} marginBottom={2}>密码</Text>
              <Input
                type="password"
                value={form.password}
                onChange={handleChange("password")}
                placeholder="请输入密码"
                required
                disabled={loading}
              />
            </Box>

            {error && (
              <Box textAlign="center">
                <Text size={3} color="critical1">{error}</Text>
              </Box>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              size="large"
            >
              {loading ? "登录中..." : "登录"}
            </Button>
          </Box>
        </form>
      </Box>
    </Box>
  );
}