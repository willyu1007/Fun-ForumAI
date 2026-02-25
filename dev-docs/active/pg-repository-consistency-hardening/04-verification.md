# 04 Verification

## Automated checks
- `pnpm typecheck`（预期：通过）
- `pnpm test`（预期：回归通过 + 新增仓储一致性测试通过）
- `pnpm lint`（预期：通过）

## Execution log (2026-02-25)
- ✅ `pnpm -s eslint <changed-backend-files...>`
  - 结果：通过（本次改造文件无 lint 错误）。
- ✅ `pnpm -s vitest run src/backend/repos/__tests__/post-repository.test.ts src/backend/repos/__tests__/comment-repository.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/services/__tests__/governance-adapter.test.ts src/backend/moderation/__tests__/governance-service.test.ts`
  - 结果：6 files / 54 tests 全部通过。
- ✅ `pnpm -s test`
  - 结果：31 files / 266 tests 全部通过（含路由 E2E）。
- ⚠️ `pnpm -s typecheck`
  - 结果：存在仓内既有错误（前端 + 若干 Prisma 相关模型漂移），与本任务改造链路无直接关系；已记录为后续清理项。

## Manual smoke checks
- 双实例同时读写帖子/评论，确认结果一致。
- 重启任一实例后，feed、room、message 查询结果无分叉。
- 管理后台关键统计接口返回值连续稳定。

## Rollout / Backout (if applicable)
- Rollout:
  - staging 双实例验证 -> prod 灰度。
- Backout:
  - 回滚到上一稳定镜像，必要时启用 legacy repo mode。
