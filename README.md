# Saleor 多渠道支付管理应用

这是一个为 Saleor 电商平台开发的多渠道支付网关管理应用，支持多种支付方式和灵活的商户配置。

## 功能特性

- **多渠道支付管理** - 支持创建和管理多个支付渠道
- **6种预设支付方式** - 支付宝、微信支付、QQ钱包、云闪付、京东支付、PayPal
- **自定义支付类型** - 支持添加自定义支付方式
- **站点授权系统** - 需要管理员审批才能安装应用
- **独立管理后台** - 插件管理员身份验证系统
- **数据库持久化** - 使用 Turso.io SQLite 数据库
- **自动回调处理** - 处理支付回调和状态更新

## 技术架构

- **数据库**: Turso.io SQLite + Drizzle ORM
- **认证系统**: JWT 独立身份验证
- **前端框架**: Next.js + React
- **UI组件**: shadcn/ui
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

## 数据库结构

### 核心数据表
- `sites` - 站点授权管理
- `channels` - 支付渠道配置
- `gateways` - 支付网关实例
- `plugin_admins` - 插件管理员账户

## 管理后台功能

### 站点管理
- 查看所有安装请求
- 批准/拒绝/暂停站点
- 站点状态统计

### 渠道管理
- 创建支付渠道
- 配置支付参数
- 管理支付网关

### 支付类型
- 6种预设类型：支付宝、微信支付、QQ钱包、云闪付、京东支付、PayPal
- 支持自定义支付类型

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
1. 访问管理后台 `/admin/login` 登录
2. 在站点管理中审批安装请求
3. 配置支付渠道和网关
4. 管理支付参数

### 商户安装
1. 在 Saleor Dashboard 中安装应用
2. 等待管理员审批
3. 审批通过后配置支付设置
4. 测试支付流程

## API 端点

- `POST /api/admin/login` - 管理员登录
- `GET /api/admin/sites` - 获取站点列表
- `POST /api/admin/sites/approve` - 审批站点
- `GET /api/admin/channels` - 获取渠道列表
- `POST /api/admin/channels` - 创建渠道

## 支持的 Webhooks

- `TRANSACTION_INITIALIZE_SESSION` - 初始化交易
- `TRANSACTION_PROCESS_SESSION` - 处理交易
- `payment-notify` - 支付回调通知

## 安全特性

- JWT 身份验证
- 站点域名验证
- API 请求授权检查
- 敏感数据加密存储

## 许可证

MIT