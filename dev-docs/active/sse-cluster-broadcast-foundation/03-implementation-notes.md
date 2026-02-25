# 03 Implementation Notes

## Status
- Current status: `planned`
- Last updated: 2026-02-25

## What changed
- 新建 SSE 集群广播任务包，明确“先增强 SSE，再评估 WS”的执行路径。

## Files/modules touched (high level)
- `src/backend/sse/`
- `src/backend/routes/sse.ts`
- `src/frontend/api/use-sse.ts`
- `ops/deploy/`
- `env/`

## Decisions & tradeoffs
- Decision:
  - 保持 SSE 对外契约不变，内部改为可切换 cluster 广播。
  - Rationale:
    - 最小化前端迁移成本，先解决多实例广播正确性。
  - Alternatives considered:
    - 立即全量切换 WebSocket（当前阶段收益不足）。

## Deviations from plan
- Change:
  - 无（初始版本）
  - Why:
    - N/A
  - Impact:
    - N/A

## Known issues / follow-ups
- 需与 T-023/T-024 对齐灰度顺序，避免并发改造冲突。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
