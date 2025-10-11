# 数据库迁移：从 Upstash Redis 到 Turso.io

## 🎯 迁移完成

系统已成功从Upstash Redis迁移到Turso.io SQLite数据库！

### ✅ 已完成的迁移内容

1. **依赖更新**
   - 安装了 `@libsql/client` 和 `drizzle-orm`
   - 移除了对Redis的依赖

2. **数据库架构**
   - 创建了 `src/lib/db/schema.ts` - 数据库表结构定义
   - 创建了 `src/lib/db/turso-client.ts` - 数据库连接和初始化

3. **数据表设计**
   - `channels` 表：支付渠道（如支付宝渠道、微信渠道）
   - `gateways` 表：具体支付通道（如支付宝1、支付宝2等）

4. **管理器更新**
   - `src/lib/managers/channel-manager.ts` - 渠道CRUD操作
   - `src/lib/managers/gateway-manager.ts` - 通道CRUD操作

5. **API接口**
   - `src/pages/api/admin/channels.ts` - 渠道管理API
   - `src/pages/api/admin/gateways.ts` - 通道管理API（已存在，已更新）
   - `src/pages/api/plugin-admin/init-db.ts` - 数据库初始化API

6. **环境变量**
   - 更新了 `.env.example` 和 `.env` 配置
   - 替换了Redis配置为Turso配置

---

## ⚙️ 配置说明

### 环境变量配置

```bash
# Turso 数据库配置
TURSO_DATABASE_URL=file:./dev.db           # 本地开发用SQLite文件
TURSO_AUTH_TOKEN=                          # 本地开发可为空

# 生产环境示例：
# TURSO_DATABASE_URL=libsql://your-db.turso.io
# TURSO_AUTH_TOKEN=your-auth-token
```

### 数据库初始化

第一次运行时需要初始化数据库表：

1. 启动应用：`pnpm dev`
2. 登录插件管理员账号
3. 访问：`POST /api/plugin-admin/init-db`
4. 或者在代码中调用：`initializeDatabase()`

---

## 🗄️ 数据库表结构

### channels 表（支付渠道）
```sql
CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### gateways 表（支付通道）
```sql
CREATE TABLE gateways (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  icon TEXT,
  pid TEXT NOT NULL,
  key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  is_mandatory INTEGER NOT NULL DEFAULT 0,
  allowed_users TEXT NOT NULL DEFAULT '[]',
  is_global INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);
```

---

## 🔄 数据迁移步骤

如果你之前在Redis中有数据，需要手动迁移：

### 1. 导出Redis数据
```javascript
// 获取所有渠道
const channelIds = await redis.smembers("channels:all");
for (const id of channelIds) {
  const channelData = await redis.get(`channel:${id}`);
  // 保存到文件或直接插入Turso
}

// 获取所有通道
const gatewayIds = await redis.smembers("gateways:all");
for (const id of gatewayIds) {
  const gatewayData = await redis.get(`gateway:${id}`);
  // 保存到文件或直接插入Turso
}
```

### 2. 导入到Turso
```javascript
import { channelManager, gatewayManager } from "./src/lib/managers";

// 导入渠道
for (const channelData of exportedChannels) {
  await channelManager.create(channelData);
}

// 导入通道
for (const gatewayData of exportedGateways) {
  await gatewayManager.create(gatewayData);
}
```

---

## 🚀 Turso.io 优势

相比Redis的优势：

1. **关系型数据库**
   - 支持外键约束
   - 支持复杂查询
   - 数据一致性更好

2. **成本更低**
   - 免费额度更大
   - 按实际使用计费

3. **更好的开发体验**
   - 支持SQL语法
   - 有Web管理界面
   - 更好的调试工具

4. **多地区分布**
   - 全球边缘部署
   - 更低延迟
   - 更高可用性

---

## 📝 使用说明

### 本地开发
```bash
# 数据库文件会自动创建在项目根目录
TURSO_DATABASE_URL=file:./dev.db
TURSO_AUTH_TOKEN=
```

### 生产环境

1. **注册Turso账号**: https://turso.tech/
2. **创建数据库**:
   ```bash
   turso db create your-payment-db
   ```
3. **获取连接信息**:
   ```bash
   turso db show your-payment-db
   turso db tokens create your-payment-db
   ```
4. **更新环境变量**:
   ```bash
   TURSO_DATABASE_URL=libsql://your-payment-db-xxx.turso.io
   TURSO_AUTH_TOKEN=your-auth-token
   ```

### 多站点共享

所有使用相同Turso数据库的Saleor站点会自动共享支付配置：

- 插件管理员在任一站点创建的渠道/通道，其他站点都能看到
- 普通管理员只能启用/禁用，不能修改配置
- 通过白名单控制特定通道的访问权限

---

## 🔍 调试工具

### 查看数据库内容
```bash
# 如果使用本地SQLite
sqlite3 dev.db
.tables
SELECT * FROM channels;
SELECT * FROM gateways;

# 如果使用Turso cloud
turso db shell your-payment-db
```

### 重置数据库
```bash
# 本地开发
rm dev.db
# 然后重新调用 /api/plugin-admin/init-db

# 生产环境
turso db destroy your-payment-db
turso db create your-payment-db
# 然后重新调用 /api/plugin-admin/init-db
```

---

## ⚠️ 注意事项

1. **数据备份**：生产环境记得定期备份数据库
2. **权限管理**：只有插件管理员能初始化数据库
3. **环境隔离**：开发和生产使用不同的数据库
4. **性能优化**：Turso会自动处理缓存和优化

迁移完成！现在你的支付插件使用更现代、更可靠的Turso数据库了。🎉