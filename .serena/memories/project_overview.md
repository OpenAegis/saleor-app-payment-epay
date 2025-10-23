# Project Overview
- Purpose: Saleor 彩虹易支付集成应用，为 Saleor 平台提供彩虹易支付渠道管理、订单创建、回调处理等能力。
- Core features: 多通道支付配置、站点授权、彩虹易支付 API (v1/v2) 交互、支付回调与状态同步、配置测试工具。
- Tech stack: Next.js 14 + React 18、TypeScript、TRPC、URQL、Drizzle ORM (Turso SQLite)、JWT 身份验证、Macaw UI、Pino 日志、GraphQL Code Generator.
- Key directories: `src/pages` (API routes & 前端页面), `src/lib` (支付/认证等库), `src/modules` (业务逻辑模块), `src/scripts` (维护脚本), `src/migrations` (Turso 数据库迁移), `graphql` (Saleor GraphQL schemas).
- Deployment: Node.js >=18，pnpm >=8；支持本地开发、Vercel 部署。