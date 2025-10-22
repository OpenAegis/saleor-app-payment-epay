# 配置结构适配修复

## 🔧 **问题原因**

数据库配置结构发生了变化，配置对象现在使用不同的属性名：

### 旧结构 vs 新结构
```typescript
// 旧结构 (之前)
{
  id: string,
  pid: string,
  key: string,
  apiUrl: string
}

// 新结构 (现在)
{
  configurationId: string,
  configurationName: string,
  pid: string,
  key: string,
  apiUrl: string,
  returnUrl?: string,
  enabled: boolean,
  // 其他属性...
}
```

## ✅ **修复内容**

### 1. 更新日志输出
```typescript
// 修复前
configId: firstConfig.id  // ❌ 属性不存在

// 修复后  
configurationId: firstConfig.configurationId,  // ✅ 正确属性
configurationName: firstConfig.configurationName
```

### 2. 兼容网关 ID 查找
```typescript
// 修复前
gatewayConfigs.find((g: any) => g.id === channel.gatewayId)

// 修复后 - 同时支持新旧格式
gatewayConfigs.find((g: any) => 
  g.configurationId === channel.gatewayId || g.id === channel.gatewayId
)
```

### 3. 改进日志输出
```typescript
// 同时显示新旧 ID 格式
gatewayConfigIds: gatewayConfigs.map((g: any) => g.configurationId || g.id)
```

## 🎯 **预期结果**

修复后的代码现在能够：
1. ✅ 正确读取新的配置数据结构
2. ✅ 兼容可能存在的旧格式数据
3. ✅ 提供详细的调试信息
4. ✅ 成功构建部署

## 📋 **测试步骤**

1. 等待构建完成
2. 重新测试支付流程
3. 应该看到详细的配置读取日志
4. 确认配置是否正确加载

## 🔍 **预期日志输出**

现在应该能看到类似：
```json
{
  "msg": "使用默认配置",
  "usingDefaultConfig": true,
  "hasPid": true,
  "hasKey": true, 
  "hasApiUrl": true,
  "configurationId": "some-config-id",
  "configurationName": "默认支付配置"
}
```

如果看到这样的日志，说明配置读取成功，应该能继续到 epay API 调用阶段。