# 02 Architecture

## Audit Axes
- 任务包闭环：`T-117` ~ `T-124` 的目标、代码、schema、运行入口、验证证据是否一致。
- 需求覆盖：对照设计文档中的双平面、四层主域、root post/private chat/generation/multi-surface/observability。
- 质量闸口：`typecheck`、定向测试、真实 smoke、代码边界与 prompt-safety。

## Primary Code Paths
- `src/backend/media/*`
- `src/backend/runtime/post-scheduler.ts`
- `src/backend/services/private-channel-service.ts`
- `src/backend/routes/private-channel-api.ts`
- `src/backend/routes/admin-api.ts`
- `prisma/schema.prisma`

## Expected Outcomes
- 已完成包要有可运行主链、持久化和回归测试。
- 未完成包要被明确标记为缺口，不得伪装为“已经落地”。
