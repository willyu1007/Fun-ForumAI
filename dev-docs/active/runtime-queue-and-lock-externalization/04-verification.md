# 04 Verification

## Automated checks
- `pnpm typecheck`（预期：通过）
- `pnpm test`（预期：现有回归通过 + 新增 runtime/queue/lock 测试通过）
- `pnpm lint`（预期：通过）

## Manual smoke checks
- 双实例启动后，触发同一事件，确认仅一次有效消费写入。
- 双实例运行 10 分钟，确认 scheduler 仅单活实例执行。
- 人工模拟队列依赖短暂不可用，确认告警触发且系统可回退。

## Rollout / Backout (if applicable)
- Rollout:
  - dev -> staging 双副本 -> prod 灰度（1->2->N）
- Backout:
  - 关闭 shared queue/lock feature flags，降级单实例 in-memory 模式。

## Verification runs (2026-02-25)
- `pnpm -s vitest run src/backend/runtime/__tests__/event-queue.test.ts src/backend/runtime/__tests__/leader-elector.test.ts`
  - Result: pass (2 files, 8 tests)
- `pnpm -s eslint src/backend/container.ts src/backend/server.ts src/backend/lib/config.ts src/backend/runtime/event-queue.ts src/backend/runtime/leader-elector.ts src/backend/runtime/runtime-loop.ts src/backend/runtime/private-channel-scheduler.ts src/backend/services/room-lifecycle.ts src/backend/services/conversation-clock.ts src/backend/routes/control-plane.ts src/backend/app.ts src/backend/runtime/__tests__/event-queue.test.ts src/backend/runtime/__tests__/leader-elector.test.ts`
  - Result: pass
- `pnpm -s test`
  - Result: pass (30 files, 262 tests)
- `pnpm -s typecheck`
  - Result: fail (existing baseline issues outside T-023 scope: frontend unused symbol, allocator config event type drift, Prisma model/type mismatch, chat-api query typing)

## Phase 3 local rollout rehearsal (2026-02-25)
- Environment:
  - Redis: `redis-memory-server` @ `127.0.0.1:50821`
  - Node1: `PORT=4101` + `RUNTIME_QUEUE_BACKEND=redis` + `RUNTIME_LEADER_BACKEND=redis`
  - Node2: `PORT=4102` + same redis config
- Command summary:
  - Seed events: `POST /v1/dev/seed` (node1) → 15 events enqueued
  - Parallel ticks (4 rounds): node1+node2 `POST /v1/dev/runtime/tick`
  - Runtime stats: `GET /v1/admin/runtime/stats` (both nodes)
  - Leader-key observation: poll `t023:leader:*` for 75s
  - Backout rehearsal: launch `PORT=4103` with `RUNTIME_QUEUE_BACKEND=in-memory` + `RUNTIME_LEADER_BACKEND=in-memory`
- Observed results:
  - Queue consumption:
    - Round1: node1 processed 10, node2 processed 0
    - Round2: node1 processed 5, node2 processed 0
    - Final: both processed 0, queue size=0
  - Runtime single-active:
    - At each round only one node processed events; the peer consistently returned `processed_events=0`
  - Scheduler single-active evidence:
    - `t023:leader:room-lifecycle` and `t023:leader:conversation-clock` sampled with single owner pid (`43035`) during TTL window
  - Backout evidence:
    - in-memory node `/v1/admin/runtime/stats` returned `queue_backend=in-memory`, `leader_backend=in-memory`, `is_leader=true`
- Notes:
  - LLM key absent in local rehearsal; executor attempts returned 401 but queue ack/dequeue and leader behavior remained verifiable.

## Staging execution assets validation (2026-02-25)
- `node scripts/runtime-staging-smoke.mjs --help`
  - Result: pass (CLI usage and args rendered correctly)
- `node scripts/runtime-staging-smoke.mjs --node1-url http://127.0.0.1:4101 --node2-url http://127.0.0.1:4102 --admin-token dummy --dry-run`
  - Result: pass (execution plan rendered without network side effects)
- `node scripts/runtime-staging-smoke.mjs --node1-url http://127.0.0.1:4101 --node2-url http://127.0.0.1:4102 --dev-auth --dry-run`
  - Result: pass (`--dev-auth` token path works, no real login required in dev)
- `node scripts/runtime-staging-smoke.mjs --discover-nodes-k8s --dev-auth --dry-run`
  - Result: fail (expected in current workstation): `kubectl` attempted default API `http://localhost:8080`, connection refused
  - Interpretation: script auto-discovery path is wired; blocked by missing kube context/cluster access, not by smoke script logic

## No-kube local replacement smoke (2026-02-25)
- Context:
  - No staging kube context available on workstation.
  - Executed equivalent dual-node smoke locally with shared Redis backend.
- Environment:
  - Temporary Redis: `redis-memory-server` at `127.0.0.1:59902`
  - Node1: `PORT=4101`, `RUNTIME_QUEUE_BACKEND=redis`, `RUNTIME_LEADER_BACKEND=redis`, `RUNTIME_ENABLED=true`
  - Node2: `PORT=4102`, same runtime redis config
  - Auth path: `--dev-auth` (base64 dev admin token), no real admin login
- Leader-only smoke:
  - Command:
    - `node scripts/runtime-staging-smoke.mjs --node1-url http://127.0.0.1:4101 --node2-url http://127.0.0.1:4102 --dev-auth --sample-duration-ms 30000 --poll-ms 2000`
  - Result: pass
  - Evidence summary:
    - `dualLeaderSamples=0`
    - `singleLeaderSamples=15`
    - `queueDrained=true`
    - Final leader state stable (`node2.isLeader=true`, `node1.isLeader=false`)
- Injection smoke:
  - Seed:
    - `POST /v1/dev/seed` on node1 returned valid `community_id`/`agent_id`
  - Command:
    - `SERVICE_AUTH_SECRET=dev-service-secret-change-in-production node scripts/runtime-staging-smoke.mjs --node1-url http://127.0.0.1:4101 --node2-url http://127.0.0.1:4102 --dev-auth --inject-posts --community-id comm_1772010107842_1 --actor-agent-id agent_1772010107842_1 --event-count 8 --sample-duration-ms 30000 --poll-ms 2000 --wait-drain-ms 90000`
  - Result: pass
  - Evidence summary:
    - `dualLeaderSamples=0`
    - `singleLeaderSamples=15`
    - `queueDrained=true` after injection
- Notes:
  - During run, conversation clock emitted expected LLM 401 logs due dummy API key; does not affect queue/leader correctness validation.
