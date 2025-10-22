# 支付配置调试指南

## 🔍 当前状态

- ✅ 认证检查通过
- ✅ 站点授权检查通过  
- ❌ 支付配置未找到

## 🛠 调试步骤

### 1. 重新测试支付流程
现在会显示详细的配置读取日志，包括：

```json
{
  "msg": "开始获取支付配置",
  "saleorApiUrl": "https://api.lzsm.shop/graphql/",
  "hasToken": true,
  "channelId": "none"
}

{
  "msg": "从 metadata 获取配置结果",
  "hasConfig": true,
  "configType": "object", 
  "configKeys": ["configurations"],
  "configurationsLength": 1
}
```

### 2. 可能的配置问题

#### 问题 A: 配置结构不匹配
如果看到 `configurationsLength: 0`，说明：
- 配置没有正确保存到数据库
- 或数据结构与代码预期不符

#### 问题 B: 通道映射缺失
如果有 channelId 但找不到通道：
- 需要在支付应用后台配置通道映射
- 关联 Saleor Channel 与 Payment Gateway

#### 问题 C: 网关 ID 不匹配
如果通道存在但网关配置不匹配：
- 检查网关 ID 是否正确
- 确认配置中的 ID 与请求中的 gatewayId 匹配

### 3. 配置检查清单

**数据库配置**：
- [ ] Epay 配置已保存（PID、Key、API URL）
- [ ] 配置结构正确
- [ ] 配置状态为启用

**通道映射**：
- [ ] Saleor Channel 已创建
- [ ] Payment Gateway 已关联到 Channel
- [ ] Gateway ID 匹配请求中的 gatewayId

**权限验证**：
- [ ] 应用有访问 metadata 的权限
- [ ] 认证令牌有效

## 🎯 下一步

根据日志输出确定具体问题：
1. 如果配置读取失败 → 检查数据库和权限
2. 如果配置为空 → 重新配置支付参数  
3. 如果通道映射失败 → 配置通道关联
4. 如果都正常 → 检查数据结构兼容性