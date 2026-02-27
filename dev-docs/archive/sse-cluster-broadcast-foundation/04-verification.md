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

## Verification runs (2026-02-25)
- `pnpm -s vitest run src/backend/sse/__tests__/hub.test.ts`
  - Result: pass (4 tests)
  - Coverage: 本地全局广播、本地房间广播、跨实例全局 fanout、跨实例房间 fanout + 去重
- `pnpm -s eslint src/backend/container.ts src/backend/lib/config.ts src/backend/routes/control-plane.ts src/backend/routes/sse.ts src/backend/sse/hub.ts src/backend/sse/contracts.ts src/backend/sse/adapters/local-broadcast-adapter.ts src/backend/sse/adapters/redis-pubsub-broadcast-adapter.ts src/backend/sse/__tests__/hub.test.ts`
  - Result: pass
- `pnpm -s eslint src/frontend/api/use-sse.ts src/frontend/app/sse-context.ts src/frontend/app/sse-provider.tsx src/frontend/features/admin/components/RuntimeDashboard.tsx`
  - Result: pass
- `pnpm -s test`
  - Result: pass (31 files, 266 tests)

## Notes
- ~~当前验证为代码级 + 本地测试验证；真实 staging 跨实例广播 smoke 待执行~~ → staging K8s 双实例 SSE fanout smoke 已通过（2026-02-25）。

## Kind local cluster smoke (2026-02-25)
- Scenario: two SSE clients connected to different backend pods; create post on node1; verify cross-instance fanout.
- Steps:
  - Port-forward two backend pods (`4301/4302`)
  - Open SSE stream on both nodes (`/v1/events/stream`)
  - Create post via node1 (`POST /v1/posts`)
  - Assert both streams receive `POST_CREATED` with identical `payload.post_id`
- Result: pass
  - post id: `cmm2mc6yn000219kiemkb5r0l`
  - node1 event: `POST_CREATED`
  - node2 event: `POST_CREATED`
- Note:
  - Test harness uses `Accept-Encoding: identity` to avoid compression buffering in Node fetch SSE stream parsing.

## Reusable script run (2026-02-25)
- `pnpm smoke:t025:k8s`
  - Result: pass
  - Evidence sample:
    - post id: `cmm2msqg0000019nb9yadc9yp`
    - node1 event: `POST_CREATED`
    - node2 event: `POST_CREATED`
    - payload post ids consistent across nodes

## Second-pass staging smoke (2026-02-25)
- Suite run: `node scripts/t023-t025-k8s-smoke-suite.mjs` → T-025 section PASS
  - pods: `backend-68bd86fc6c-hnwxm`, `backend-68bd86fc6c-thn6c`
  - post id: `cmm2n6co9000019p0e1i6rpt4`
  - node1 event: `POST_CREATED`, node2 event: `POST_CREATED`
  - payload post_id consistent across both nodes

## WebSocket migration threshold document (2026-02-25)
- Produced: `ws-migration-threshold.md`
- Covers: trigger conditions (bidirectional needs + SSE perf thresholds), current baseline, tuning ladder, E-09 evaluation process, monitoring/alerting rules, review cadence
- Current conclusion: all indicators well below thresholds, no migration needed
