# Saleor Webhook 认证问题分析

## 🔍 当前状态

✅ **Webhook 解析成功**: 请求体格式问题已修复
❌ **认证失败**: `缺少必要的Saleor API信息`

## 📋 分析发现

### 1. GraphQL 客户端认证方式
从 `create-graphq-client.ts` 可以看出，这个应用使用 `Authorization-Bearer` 头：
```typescript
fetchOptions: {
  headers: {
    "Authorization-Bearer": token,
  },
}
```

### 2. 当前 Webhook 认证检查
```typescript
const authToken = req.headers["authorization"]?.replace("Bearer ", "");
```
这里查找的是标准的 `Authorization` 头。

### 3. 可能的问题

**选项 A**: Saleor webhook 不发送 Authorization 头
- Transaction webhooks 可能使用应用级认证而不是用户级认证
- 需要检查是否存在其他认证机制

**选项 B**: 认证头名称不匹配
- 应该检查 `authorization-bearer` 而不是 `authorization`

**选项 C**: 应用认证机制
- Saleor App 可能使用 JWT 或应用级密钥认证

## 🛠 修复策略

### 立即步骤
1. 部署当前调试版本查看完整请求头
2. 确认 Saleor 实际发送的认证信息

### 潜在修复方案

#### 方案 1: 检查多种认证头
```typescript
const authToken = 
  req.headers["authorization"]?.replace("Bearer ", "") ||
  req.headers["authorization-bearer"] ||
  req.headers["saleor-authorization"];
```

#### 方案 2: 跳过认证检查（临时）
如果 webhook 本身通过其他机制验证，可以暂时跳过这个检查：
```typescript
// 临时跳过认证检查用于调试
const authToken = "temp-token-for-debug";
```

#### 方案 3: 使用应用级认证
从环境变量或配置中获取应用级认证令牌。

## 📊 预期调试输出

部署后应该看到类似：
```json
{
  "level": 30,
  "saleorApiUrl": "https://api.lzsm.shop/graphql/",
  "hasAuthToken": false,
  "authTokenLength": 0,
  "allHeaders": ["host", "user-agent", "saleor-api-url", ...],
  "authorization": "missing",
  "msg": "Checking Saleor API credentials"
}
```

这将帮助我们确定 Saleor 实际发送了哪些认证信息。

## 🎯 下一步

1. 等待调试部署完成
2. 重新测试支付流程
3. 查看详细的请求头日志
4. 根据实际情况选择合适的修复方案