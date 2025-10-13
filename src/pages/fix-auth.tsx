import { useState } from "react";
import { Box, Input, Button, Text } from "@saleor/macaw-ui";
import { type NextPage } from "next";

const FixAuthPage: NextPage = () => {
  const [saleorApiUrl, setSaleorApiUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const fixAuthData = async () => {
    if (!saleorApiUrl || !domain) {
      setResult({ success: false, message: "请填写所有字段" });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/fix-auth-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ correctSaleorApiUrl: saleorApiUrl, correctDomain: domain }),
      });

      const data = await response.json();
      setResult({
        success: response.ok,
        message: response.ok
          ? data && typeof data === "object" && "message" in data
            ? String(data.message)
            : "修复成功"
          : data && typeof data === "object" && "error" in data
          ? String(data.error)
          : "修复失败",
      });
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "未知错误",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="flex" flexDirection="column" gap={4} padding={4}>
      <h1>修复认证数据</h1>

      <Box display="flex" flexDirection="column" gap={2}>
        <Text>当前认证数据使用了占位符URL。请提供正确的Saleor API URL和域名来修复。</Text>

        <Input
          label="Saleor API URL"
          value={saleorApiUrl}
          onChange={(e) => setSaleorApiUrl(e.target.value)}
          placeholder="https://your-saleor-instance.com/graphql/"
        />

        <Input
          label="域名"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="your-saleor-instance.com"
        />

        <Button onClick={() => void fixAuthData()} disabled={loading}>
          {loading ? "修复中..." : "修复认证数据"}
        </Button>
      </Box>

      {result && (
        <Box
          padding={2}
          backgroundColor={result.success ? "success1" : "critical1"}
          borderRadius={4}
        >
          <Text>{result.message}</Text>
        </Box>
      )}
    </Box>
  );
};

export default FixAuthPage;
