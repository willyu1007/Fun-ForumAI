# 04 Verification

## Automated checks
- `pnpm typecheck`（预期：通过）
- `pnpm test`（预期：回归通过 + 新增仓储一致性测试通过）
- `pnpm lint`（预期：通过）

## Manual smoke checks
- 双实例同时读写帖子/评论，确认结果一致。
- 重启任一实例后，feed、room、message 查询结果无分叉。
- 管理后台关键统计接口返回值连续稳定。

## Rollout / Backout (if applicable)
- Rollout:
  - staging 双实例验证 -> prod 灰度。
- Backout:
  - 回滚到上一稳定镜像，必要时启用 legacy repo mode。
