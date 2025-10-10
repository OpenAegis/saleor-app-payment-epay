# Saleor 彩虹易支付应用

这是一个为 Saleor 电商平台集成的第三方支付网关应用，支持彩虹易支付（Epay）服务。

## 功能特性

- 支持支付宝、微信支付等多种支付方式
- 自动处理支付回调和状态更新
- 可配置的商户参数
- 与 Saleor 交易系统无缝集成

## 安装要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Saleor 3.13+

## 安装步骤

1. 克隆仓库：
   ```bash
   git clone <repository-url>
   cd saleor-app-payment-epay
   ```

2. 安装依赖：
   ```bash
   pnpm install
   ```

3. 配置环境变量：
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，填入您的配置信息
   ```

4. 启动开发服务器：
   ```bash
   pnpm dev
   ```

## 配置说明

在 `.env` 文件中配置以下参数：

- `EPAY_PID` - 彩虹易支付商户ID
- `EPAY_KEY` - 彩虹易支付商户密钥
- `EPAY_API_URL` - 彩虹易支付API地址
- `APP_URL` - 应用的公网URL
- `STOREFRONT_URL` - 商店前端URL

## 部署

构建生产版本：
```bash
pnpm build
```

启动生产服务器：
```bash
pnpm start
```

## 使用说明

1. 在 Saleor Dashboard 中安装此应用
2. 在应用配置页面输入您的彩虹易支付商户信息
3. 在支付设置中启用此支付方式
4. 测试支付流程确保一切正常工作

## 支持的 Webhooks

- `TRANSACTION_INITIALIZE_SESSION` - 初始化交易
- `TRANSACTION_PROCESS_SESSION` - 处理交易
- `epay-notify` - 彩虹易支付回调通知

## 许可证

MIT