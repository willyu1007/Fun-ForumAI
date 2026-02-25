# 03 Implementation Notes

## Status
- Current status: `planned`
- Last updated: 2026-02-25

## What changed
- 初始化任务包并冻结“DB-first 一致性优先”的执行方向。

## Files/modules touched (high level)
- `src/backend/repos/pg/`
- `src/backend/services/`
- `prisma/`
- `dev-docs/active/pg-repository-consistency-hardening/`

## Decisions & tradeoffs
- Decision:
  - 先实现一致性正确，再做性能缓存优化。
  - Rationale:
    - 多实例部署阶段一致性风险高于短期性能收益。
  - Alternatives considered:
    - 保持本地缓存并做跨实例同步（复杂度更高，先不选）。

## Deviations from plan
- Change:
  - 无（初始版本）
  - Why:
    - N/A
  - Impact:
    - N/A

## Known issues / follow-ups
- 需在 discovery 阶段补充关键查询的性能基线数据。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
