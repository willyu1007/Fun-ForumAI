# 03 Implementation Notes

## Status
- Current status: `done`
- Last updated: 2026-02-25

## What changed
- 已落地 Runtime Queue/Leader 抽象与实现：
  - `RuntimeEventQueue` + `InMemoryRuntimeEventQueue` + `RedisStreamRuntimeEventQueue`
  - `LeaderElector` + `InMemoryLeaderElector` + `RedisLeaderElector`
- Runtime 主链路接入完成：
  - `RuntimeLoop` 改为 handle-based ack/retry 语义，并支持 leader gating
  - `EventBridge` 改为 async enqueue
  - `PrivateChannelScheduler` / `RoomLifecycleManager` / `ConversationClock` 增加 leader gating
- `container.ts` 完成 shared/in-memory 双模式注入：
  - `RUNTIME_QUEUE_BACKEND` / `RUNTIME_LEADER_BACKEND` feature flag
  - Redis 连接失败自动回退 in-memory
  - 各 scheduler 使用独立 leader key（`leader:<scope>`）
- 控制面可观测增强：
  - `dev/runtime/status` 与 `admin/runtime/stats` 增加 `is_leader`、backend 信息
- 运行生命周期补齐：
  - `server.ts` 关停时停止 runtime/scheduler，并执行 runtime infra close/release
- Phase 3 本地执行（2026-02-25）：
  - 启动 2 个 backend 实例（`4101/4102`）共享同一 Redis（`redis-memory-server`）。
  - 向 node1 注入 15 个事件后并发触发两节点 `POST /v1/dev/runtime/tick`：
    - Round1: node1 `processed_events=10`, node2 `processed_events=0`
    - Round2: node1 `processed_events=5`, node2 `processed_events=0`
    - 队列从 15 下降到 0（无重复消费）
  - 轮询 Redis leader key 75 秒，观察到：
    - `t023:leader:room-lifecycle`、`t023:leader:conversation-clock` 始终由单一 owner 持有（pid=43035）
  - 回退演练（本地）：
    - 启动 in-memory 模式实例（`4103`），`/v1/admin/runtime/stats` 返回 `queue_backend=in-memory`、`leader_backend=in-memory`
- Staging 执行准备（2026-02-25）：
  - 新增 staging smoke 脚本：`scripts/runtime-staging-smoke.mjs`
  - 新增运维 runbook：`ops/deploy/handbook/runbooks/runtime-staging-rollout-and-backout.md`
  - smoke 脚本新增 `--dev-auth`（development 下可免登录生成 admin dev token）
  - smoke 脚本新增 `--discover-nodes-k8s`：
    - 可通过 `kubectl get pods` 自动发现两实例并自动 `port-forward`
    - 支持覆盖参数：`--k8s-namespace` / `--k8s-label-selector` / `--k8s-context` / `--k8s-pod-1` / `--k8s-pod-2`
  - 脚本支持两类验证：
    - leader-only 观测（无 dual leader）
    - 注入 post 事件并验证队列回落
  - 脚本支持回退前后 backend 断言（`redis` 或 `any`）
- 无 kube 环境替代验证（2026-02-25）：
  - 在无 staging kube context 条件下，已执行本地双节点 + 共享 Redis 的等价 smoke。
  - 结果：leader-only 与 injection 两类 smoke 均 PASS（详见 `04-verification.md`）。

## Files/modules touched (high level)
- `src/backend/runtime/`
- `src/backend/container.ts`
- `src/backend/server.ts`
- `src/backend/lib/config.ts`
- `src/backend/routes/control-plane.ts`
- `src/backend/app.ts`
- `env/`
- `package.json`
- `pnpm-lock.yaml`
- `/tmp/t023-node3.log`（本地验证日志，非仓库文件）

## Decisions & tradeoffs
- Decision:
  - 先做状态外置与单活保障，再推进传输层升级评估。
  - 采用 Redis Streams + Redis lease（保持 at-least-once + 业务幂等）。
  - leader 采用按组件分 key（runtime-loop / room-lifecycle / conversation-clock / private-channel）。
  - Rationale:
    - 当前主要风险在执行一致性，不在协议本身。
    - 分组件 key 可避免单模块停止时误释放全局锁，降低耦合。
  - Alternatives considered:
    - 直接升级 WebSocket（被拒绝，风险收益比不优）。
    - 单一全局 leader key（放弃，stop/release 生命周期耦合更高）。

## Deviations from plan
- Change:
  - 在 discovery 文档未补 ADR 前先完成了可运行代码路径（Redis + fallback）。
  - Why:
    - 用户要求直接开始实施 T-023。
  - Impact:
    - 当前已具备执行基础；后续需补 ADR 与容量估算文档闭环。

## Known issues / follow-ups
- `pnpm typecheck` 仍有大量既有历史错误（前端 unused、Prisma 模型漂移、chat-api 类型）；不由本任务引入。
- ~~本地双实例 smoke 已完成；仍需在 staging（真实 Redis + Pg 持久层）完成灰度与 runbook 演练。~~ → staging K8s 双实例 smoke 已通过（2026-02-25）。
- 后续可改进项（非阻塞）：补充 ADR 文档与容量估算、定义 DLQ 清理策略、增强 leader 续约监控。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
