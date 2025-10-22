# Transaction Initialize Webhook 调试指南

## 问题分析

从日志可以看出：
1. ✅ **连接正常**: Saleor 成功调用了支付应用的 webhook
2. ❌ **解析错误**: `Cannot destructure property 'action' of 'r' as it is undefined`

## 修复内容

已修复 `transaction-initialize.ts` 中的请求体解析逻辑：

### 1. 添加了请求体验证
```typescript
// 验证请求体结构
if (!req.body) {
  logger.error("Request body is empty");
  return res.status(400).json({
    result: "CHARGE_FAILURE",
    amount: 0,
    message: "Request body is empty",
  });
}
```

### 2. 支持多种请求体格式
```typescript
// 检查 event 属性是否存在
const body = req.body;
let event: TransactionEvent;

if (body.event) {
  // 标准格式: { event: TransactionEvent }
  event = body.event;
} else if (body.action && body.transaction) {
  // 直接格式: TransactionEvent
  event = body as TransactionEvent;
} else {
  // 无效格式
  logger.error("Invalid request body structure", { body });
  return res.status(400).json({
    result: "CHARGE_FAILURE",
    amount: 0,
    message: "Invalid request body structure",
  });
}
```

### 3. 增强了错误日志
现在会记录完整的请求体和头信息，便于调试。

## 测试步骤

### 方法 1: 直接测试支付流程
1. 在前端创建一个 checkout
2. 尝试完成支付
3. 观察支付应用的日志输出

### 方法 2: 使用测试脚本
```bash
node test-webhook.js
```

## 预期结果

修复后的 webhook 应该能够：

1. **正确解析请求体**: 无论 Saleor 发送的是哪种格式
2. **详细记录日志**: 包含完整的请求信息用于调试
3. **优雅处理错误**: 对于无效请求返回明确的错误信息

## 实际的 Saleor Transaction API 请求格式

根据 Saleor 文档，transaction initialize webhook 的请求体格式通常是：

```json
{
  "action": {
    "amount": "100.00",
    "paymentMethodType": "app"
  },
  "transaction": {
    "id": "VHJhbnNhY3Rpb25JdGVtOjE="
  },
  "sourceObject": {
    "number": "ORDER-001",
    "lines": [
      {
        "productName": "Product Name"
      }
    ]
  },
  "data": {
    "channelId": "Q2hhbm5lbDox",
    "payType": "alipay"
  }
}
```

注意：**没有外层的 `event` 包装**，这就是之前解析失败的原因。

## 下一步

修复部署后，重新测试支付流程：
1. 确认 webhook 不再报解析错误
2. 检查是否进入站点授权检查逻辑
3. 验证支付配置检查是否正常工作

## 部署和重启

修改代码后需要重新部署支付应用：
```bash
cd D:\Users\SHED03\Desktop\dickseep\saleor-app-payment-epay
npm run build
# 重启服务（根据部署方式而定）
```