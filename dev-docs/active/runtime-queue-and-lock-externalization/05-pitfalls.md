# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 不要在未完成单活和幂等验证前直接启用多副本 Runtime（keywords: duplicate-run, double-consume, lock-ttl）。

## Pitfall log (append-only)

### 2026-02-25 - Initialization
- Symptom:
  - N/A（任务初始化）
- Context:
  - 刚创建任务包，尚未进入实现。
- What we tried:
  - N/A
- Why it failed (or current hypothesis):
  - N/A
- Fix / workaround (if any):
  - N/A
- Prevention (how to avoid repeating it):
  - 首次实现前先完成 ADR 与验证基线。
- References (paths/commands/log keywords):
  - `dev-docs/active/runtime-queue-and-lock-externalization/roadmap.md`

### 2026-02-25 - ioredis adapter typing mismatch
- Symptom:
  - `pnpm typecheck` 在 `container.ts` 报 `Redis is not assignable to RedisLike`（`xadd/eval` overload 不兼容）。
- Context:
  - runtime queue/leader 从 in-memory 切到 Redis adapter 后首次编译。
- What we tried:
  - 直接使用严格签名的 `RedisLike`（固定参数与返回类型）。
- Why it failed (or current hypothesis):
  - ioredis 方法是 overload + callback 兼容签名，固定窄签名无法结构化赋值。
- Fix / workaround (if any):
  - 放宽 adapter 接口签名（`unknown` 参数/返回 + 调用点做显式解析）并保留行为测试。
- Prevention (how to avoid repeating it):
  - 第三方 SDK 适配层优先定义“最小行为契约”而非窄方法签名；先跑 typecheck 再扩实现。
- References (paths/commands/log keywords):
  - `src/backend/runtime/event-queue.ts`
  - `src/backend/runtime/leader-elector.ts`
  - `pnpm -s typecheck`

### 2026-02-25 - Leader lock sampling window false-negative
- Symptom:
  - 初次检查 `t023:leader:*` 返回空集合，误以为 scheduler leader 未生效。
- Context:
  - 本地 Phase 3 验证时，room-lifecycle tick 周期为 60s，leader TTL 为 15s。
- What we tried:
  - 单次 `keys t023:leader:*` 采样。
- Why it failed (or current hypothesis):
  - 采样时刻落在 TTL 过期到下一次 tick 之间，锁自然为空窗。
- Fix / workaround (if any):
  - 改为 75s 连续采样（1s 间隔）捕捉 TTL 窗口。
- Prevention (how to avoid repeating it):
  - 对短租约锁验证必须采用窗口采样或事件日志，而非单点读取。
- References (paths/commands/log keywords):
  - `RUNTIME_LEADER_TTL_MS=15000`
  - `room-lifecycle interval=60000`
  - `t023:leader:room-lifecycle`
