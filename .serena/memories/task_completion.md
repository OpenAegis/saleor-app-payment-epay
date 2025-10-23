# Task Completion Checklist
- 确认相关单元/集成测试已通过 (`pnpm test` 或针对性测试脚本)。
- 运行 `pnpm lint` 与 `pnpm type-check`，确保无 lint 与类型错误。
- 若改动 GraphQL schema 或查询，执行 `pnpm generate` 并检查生成文件。
- 如涉及数据库迁移，运行 `tsx src/run-migrations.ts` 验证迁移。
- 汇总关键修改点、潜在风险、后续步骤并同步给团队。