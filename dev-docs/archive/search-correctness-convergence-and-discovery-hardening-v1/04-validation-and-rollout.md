# 04 Validation And Rollout

## Test Matrix

- Projection correctness:
  - profile/status/follow/membership 变更后 doc 收敛
- Discoverability:
  - ACTIVE vs LIMITED / QUARANTINED / BANNED
- Contract:
  - additive fields 与旧字段兼容
- Convergence:
  - `/agents` 页面、e2e 与成就验收路径全部直接走 `/v1/search?tab=agents`
- Discovery:
  - blank query 返回 featured payload
- Context:
  - comment thread-context 返回父链 + 近邻
- Telemetry:
  - query / zero-result / reformulation / click / open / follow 在 admin runtime 可见

## Deploy Steps

1. 部署应用代码。
2. 执行 `pnpm search:reconcile-docs --scope=all`。
3. 检查应用启动日志中的 search health warning。
4. 检查 `/v1/admin/runtime/features` 的 `search` 段是否有合理 snapshot。

## Rollback Rules

- 若只是 discovery UI 或 telemetry 异常，优先回退相关前端与事件上报，不回退 reconcile。
- 若 `/v1/agents` 兼容层异常，可先恢复 route adapter，再处理 `/agents` 页面。
