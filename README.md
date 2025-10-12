# Saleor 彩虹易支付集成应用

这是一个为 Saleor 电商平台开发的彩虹易支付集成应用，支持多种支付方式和灵活的商户配置。

## 功能特性

- **彩虹易支付集成** - 完整集成彩虹易支付API
- **多通道支付管理** - 支持创建和管理多个支付通道
- **自定义支付方式** - 支持支付宝、微信支付、QQ钱包、银行卡支付及插件扩展的自定义支付方式
- **后台配置管理** - 只支持后台管理界面配置方式
- **商户配置管理** - 灵活的商户ID、密钥和API地址配置
- **站点授权系统** - 需要管理员审批才能安装应用
- **独立管理后台** - 插件管理员身份验证系统
- **数据库持久化** - 使用 Turso.io SQLite 数据库
- **自动回调处理** - 处理支付回调和状态更新
- **配置测试功能** - 支持测试连接验证配置正确性

## 技术架构

- **数据库**: Turso.io SQLite + Drizzle ORM
- **认证系统**: JWT 独立身份验证
- **前端框架**: Next.js + React
- **UI组件**: Macaw UI
- **表单验证**: Zod + React Hook Form

## 安装要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Saleor 3.13+
- Turso.io 数据库账户

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

4. 生成数据库模式：
   ```bash
   pnpm db:generate
   pnpm db:push
   ```

5. 启动开发服务器：
   ```bash
   pnpm dev
   ```

## 配置方式说明

本插件只支持后台管理界面配置方式：

### 后台管理界面配置（唯一方式）
通过插件后台界面进行配置，支持多商户和动态配置：
- 登录插件管理后台 `/admin/login`
- 进入支付配置页面
- 填写商户信息并保存

## 环境变量配置

在 `.env` 文件中配置以下参数：

### 基础配置
- `APP_URL` - 应用的公网URL
- `SECRET_KEY` - JWT 加密密钥

### 数据库配置
- `TURSO_DATABASE_URL` - Turso.io 数据库URL
- `TURSO_AUTH_TOKEN` - Turso.io 认证令牌

### Saleor 配置
- `SALEOR_APP_TOKEN` - Saleor 应用令牌
- `SALEOR_APP_ID` - Saleor 应用ID

### 插件管理员配置
- `ADMIN_EMAIL` - 初始管理员邮箱
- `ADMIN_PASSWORD` - 初始管理员密码

## 彩虹易支付集成说明

### 支持的支付方式
- 支付宝 (alipay)
- 微信支付 (wxpay)
- QQ钱包 (qqpay)
- 银行卡支付 (bank)
- **自定义支付方式** - 支持易支付插件扩展的任何支付方式

### API 功能
- **创建支付订单** - 通过submit.php接口创建支付订单
- **订单状态查询** - 通过api.php接口查询订单状态
- **商户信息查询** - 验证商户配置有效性
- **异步通知处理** - 处理支付成功回调

### 签名算法
- 使用MD5签名算法确保数据安全
- 自动处理签名生成和验证

## 数据库结构

### 核心数据表
- `sites` - 站点授权管理
- `channels` - 支付通道配置
- `gateways` - 支付网关实例（已弃用）
- `plugin_admins` - 插件管理员账户

## 管理后台功能

### 站点管理
- 查看所有安装请求
- 批准/拒绝/暂停站点
- 站点状态统计

### 支付配置
- 配置彩虹易支付商户信息
- 测试连接验证配置
- 启用/禁用支付功能

## 部署说明

### Vercel 部署

1. 在 Vercel 中配置环境变量
2. 构建生产版本：
   ```bash
   pnpm build
   ```

### 本地生产环境
```bash
pnpm build
pnpm start
```

## 使用流程

### 管理员操作
1. 访问独立管理后台 `/admin/login` 登录
2. 在站点管理中审批安装请求
3. 配置支付参数
4. 管理支付配置

### 商户安装
1. 在 Saleor Dashboard 中安装应用
2. 等待插件管理员审批
3. 审批通过后即可使用配置的支付方式
4. 测试支付流程

## API 端点

### 插件管理员认证
- `POST /api/plugin-admin/login` - 管理员登录
- `POST /api/plugin-admin/logout` - 管理员登出
- `GET /api/plugin-admin/verify` - 验证会话

### 支付配置
- `GET /api/epay-config` - 获取支付配置
- `POST /api/epay-config` - 保存支付配置
- `POST /api/epay-config?test=true` - 测试支付配置

### 支付处理
- `POST /api/webhooks/transaction-initialize` - 初始化支付交易
- `POST /api/webhooks/transaction-process` - 处理支付交易
- `POST /api/webhooks/epay-notify` - 彩虹易支付回调通知

## 支持的 Webhooks

- `TRANSACTION_INITIALIZE_SESSION` - 初始化交易
- `TRANSACTION_PROCESS_SESSION` - 处理交易
- `epay-notify` - 彩虹易支付回调通知

## 安全特性

- JWT 身份验证
- 站点域名验证
- API 请求授权检查
- 敏感数据加密存储
- MD5签名验证

## 技术支持

如遇到技术问题，请联系您的彩虹易支付服务提供商或插件技术支持团队。

## 许可证

MIT