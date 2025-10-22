# 修复数据库查找逻辑 - 正确的两表关联

## 🔍 **数据关系理解**

你纠正了一个重要的理解错误：

### 错误理解 (之前)
```
gatewayId: "app:saleor.app.epay:qoc0ue4mzu8u4jfdflp3jn"
直接从 gateways 表查找 ID = "qoc0ue4mzu8u4jfdflp3jn"
```

### 正确理解 (现在)
```
1. channelId: "qoc0ue4mzu8u4jfdflp3jn" (来自请求)
2. 从 channels 表查找: WHERE id = "qoc0ue4mzu8u4jfdflp3jn"
3. 获取 channels.gatewayId (例如: "gateway-abc123")  
4. 从 gateways 表查找: WHERE id = "gateway-abc123"
5. 获取实际的 epay 配置 (pid, key, apiUrl)
```

## 🛠 **修复内容**

### 1. 数据库表关系
```sql
-- channels 表 (支付通道)
channels {
  id: "qoc0ue4mzu8u4jfdflp3jn",     -- 通道ID (从请求获取)
  gatewayId: "gateway-abc123",      -- 关联的网关ID
  name: "支付宝通道",
  type: "alipay",
  enabled: true
}

-- gateways 表 (支付网关配置)
gateways {
  id: "gateway-abc123",             -- 网关ID (被通道引用)
  name: "易支付主渠道", 
  epayPid: "123456",               -- 实际配置
  epayKey: "abcdef...",
  epayUrl: "https://pay.example.com",
  enabled: true
}
```

### 2. 新的查找流程
```typescript
async function getEpayConfig(channelIdFromRequest?: string) {
  if (channelIdFromRequest) {
    // 步骤1: 提取通道ID
    const channelId = channelIdFromRequest.split(':').pop(); // "qoc0ue4mzu8u4jfdflp3jn"
    
    // 步骤2: 从 channels 表查找
    const channel = await channelManager.get(channelId);
    
    // 步骤3: 从 gateways 表查找实际配置
    if (channel?.enabled) {
      const gateway = await gatewayManager.get(channel.gatewayId);
      
      if (gateway?.enabled) {
        return {
          config: {
            pid: gateway.epayPid,
            key: gateway.epayKey, 
            apiUrl: gateway.epayUrl
          }
        };
      }
    }
  }
  
  // 回退方案：使用第一个启用的网关
  const enabledGateways = await gatewayManager.getEnabled();
  // ...
}
```

### 3. 详细的调试日志
```typescript
logger.info({ channelId, gatewayId: channel.gatewayId }, "查找通道信息");
logger.info({ gatewayFound: !!gateway, gatewayName: gateway?.name }, "查找网关配置");
logger.info({ channelName, gatewayName, hasPid, hasKey }, "找到完整的支付配置");
```

## 🎯 **预期结果**

修复后的查找流程应该显示：
```json
{
  "msg": "提取通道ID",
  "originalChannelId": "app:saleor.app.epay:qoc0ue4mzu8u4jfdflp3jn",
  "extractedChannelId": "qoc0ue4mzu8u4jfdflp3jn"
}

{
  "msg": "查找通道信息", 
  "channelId": "qoc0ue4mzu8u4jfdflp3jn",
  "found": true,
  "enabled": true,
  "gatewayId": "gateway-abc123"
}

{
  "msg": "查找网关配置",
  "gatewayId": "gateway-abc123", 
  "gatewayFound": true,
  "gatewayEnabled": true,
  "gatewayName": "易支付主渠道"
}

{
  "msg": "找到完整的支付配置",
  "channelName": "支付宝通道",
  "gatewayName": "易支付主渠道",
  "hasPid": true,
  "hasKey": true,
  "hasUrl": true
}
```

## 📋 **数据准备检查**

确保数据库中的数据配置正确：
1. ✅ `channels` 表中存在 ID = "qoc0ue4mzu8u4jfdflp3jn" 的记录
2. ✅ 该通道记录的 `gatewayId` 字段指向有效的网关
3. ✅ `gateways` 表中存在对应的网关配置
4. ✅ 网关配置包含有效的 `epayPid`、`epayKey`、`epayUrl`
5. ✅ 通道和网关都是 `enabled: true` 状态

现在的逻辑应该能正确地进行两表关联查找！