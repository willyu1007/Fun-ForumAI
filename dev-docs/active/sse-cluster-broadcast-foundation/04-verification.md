# 04 Verification

## Automated checks
- `pnpm typecheck`（预期：通过）
- `pnpm test`（预期：回归通过 + 新增 SSE cluster 集成测试）
- `pnpm lint`（预期：通过）

## Manual smoke checks
- 双实例 + 负载均衡下，任意实例触发 `POST_CREATED`，两侧客户端都能收到推送。
- 滚动重启一个实例，客户端重连后继续稳定收流。
- 压测期间检查 SSE 连接数、fanout lag、error rate。

## Rollout / Backout (if applicable)
- Rollout:
  - staging 双实例验证 -> prod 小流量灰度 -> 全量。
- Backout:
  - 关闭 cluster adapter flag，恢复 local SSE 广播路径。
