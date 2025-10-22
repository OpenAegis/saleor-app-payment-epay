# 配置读取逻辑重构 - 使用本地数据库

## 🔍 **问题原因**

从日志分析发现，配置确实存在但为空：
- ✅ `hasConfig: true` - 配置对象存在
- ✅ `configKeys: ["configurations","channelToConfigurationId"]` - 结构正确
- ❌ `configurationsLength: 0` - 配置数组为空

**根本原因**: 配置数据存储在项目自己的本地数据库（SQLite/Turso）中，而不是 Saleor 的 metadata 中。

## 🛠 **重构内容**

### 1. 数据库结构理解
```typescript
// 本地数据库表结构
gateways: {
  id: string,
  name: string,
  epayUrl: string,    // API URL
  epayPid: string,    // 商户ID  
  epayKey: string,    // 密钥
  enabled: boolean,
  // 其他字段...
}
```

### 2. 移除 Saleor Metadata 依赖
```typescript
// 移除的导入
- createServerClient
- createPrivateSettingsManager  
- EpayConfigManager
- EpayConfigEntry
- channelManager

// 新增的导入
+ gatewayManager
+ Gateway
```

### 3. 新的配置获取逻辑
```typescript
async function getEpayConfig(gatewayId?: string) {
  // 1. 从 gatewayId 提取真实ID
  // "app:saleor.app.epay:qoc0ue4mzu8u4jfdflp3jn" → "qoc0ue4mzu8u4jfdflp3jn"
  const realGatewayId = gatewayId?.split(':').pop();
  
  // 2. 查找指定网关
  if (realGatewayId) {
    const gateway = await gatewayManager.get(realGatewayId);
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
  
  // 3. 回退到第一个启用的网关
  const enabledGateways = await gatewayManager.getEnabled();
  if (enabledGateways.length > 0) {
    const firstGateway = enabledGateways[0];
    return { 
      config: {
        pid: firstGateway.epayPid,
        key: firstGateway.epayKey,
        apiUrl: firstGateway.epayUrl  
      }
    };
  }
  
  return { config: null, returnUrl: null };
}
```

### 4. 简化函数调用
```typescript
// 之前: 需要 3 个参数
await getEpayConfig(saleorApiUrl, tempAuthToken, data?.channelId)

// 现在: 只需要 1 个参数
await getEpayConfig(data?.gatewayId || data?.paymentMethodId)
```

## 🎯 **预期结果**

重构后的配置读取应该能够：
1. ✅ 从本地数据库正确读取配置
2. ✅ 根据 gatewayId 查找指定配置
3. ✅ 自动回退到默认启用的配置
4. ✅ 提供详细的调试日志

## 📋 **测试预期**

重新测试后应该看到：
```json
{
  "msg": "开始从本地数据库获取支付配置", 
  "gatewayId": "app:saleor.app.epay:qoc0ue4mzu8u4jfdflp3jn"
}

{
  "msg": "提取网关ID",
  "originalGatewayId": "app:saleor.app.epay:qoc0ue4mzu8u4jfdflp3jn",
  "extractedGatewayId": "qoc0ue4mzu8u4jfdflp3jn"  
}

{
  "msg": "找到指定网关配置",
  "gatewayId": "qoc0ue4mzu8u4jfdflp3jn",
  "gatewayName": "易支付主渠道",
  "hasPid": true,
  "hasKey": true, 
  "hasUrl": true
}
```

如果配置读取成功，应该能进入 epay API 调用阶段！

## 🚨 **注意事项**

确保数据库中已有配置数据：
1. 网关已创建且 `enabled: true`
2. 配置了正确的 `epayPid`、`epayKey`、`epayUrl`
3. 网关 ID 与请求中的 gatewayId 匹配