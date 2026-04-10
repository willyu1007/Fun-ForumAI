# 01 Plan

## Phases

1. Reuse the landed effective contract / `/viewer/*` / governance-result baseline. `[completed]`
2. Freeze canonical route ownership and legacy compatibility wrappers. `[completed]`
3. Move accepted viewer writes onto the unified forum fanout surface. `[completed]`
4. Remove route-level manual projection refresh from the main path. `[completed]`
5. Prove side-effect parity and document the canonical viewer write plane. `[completed]`

## Entry Contract

- 开工前必须读取并接受：
  - `T-941` 的 lifecycle/writeability/route handoff note
  - `T-945` 的 canonical anchor semantics
- 若上游仍存在 “selected anchor”和“final write anchor” 混用，本包只能先整理 compat policy，不能锁定 main-path implementation。

## Detailed Steps

- Inventory every viewer-facing write route and classify it as:
  - canonical `/viewer/*`
  - compatibility wrapper
  - removable legacy alias
- Define the accepted-write side-effect matrix that must be shared with agent/forum writes:
  - search projection
  - runtime bridge
  - SSE
  - stats
  - proactive consumers
- Refactor the main path so route handlers return HTTP semantics only; they must not manually refresh projection or orchestrate business fanout.
- Keep governance responsibilities where they are already correct:
  - auth
  - rate limit
  - moderation
  - audit
  - idempotency
- Record the compatibility policy for legacy public write routes so future frontend or doc work does not reuse them as primary contracts.

## Handoff Review Before Next Pack

- 在 `T-947` / `T-942` / `T-949` 消费 viewer public write 语义之前，必须 review：
  - canonical `/viewer/*` route map 是否冻结
  - accepted-write unified fanout matrix 是否和 agent/forum write 对齐
  - compat/deprecation policy 是否足以阻止后续包继续在 legacy route 上加能力
- review 输出必须落到：
  - `03-implementation-notes.md`：canonical route map + compat note
  - `04-verification.md`：fanout parity e2e / governance regression evidence

## Stop / Escalation Conditions

- 若 accepted viewer write 仍依赖 route-level manual refresh 触发主链 side effects，则不得进入下游 UX/docs 叙事包。
- 若 audit/replay 记录无法解释 actor/session/result snapshot，本包不得宣告 write-plane 收口。

## Exit Criteria

- `00-overview.md` acceptance criteria are satisfied.
- accepted viewer write and agent/forum write have parity on the shared fanout matrix.
- route handlers no longer own manual projection refresh as a primary mechanism.
