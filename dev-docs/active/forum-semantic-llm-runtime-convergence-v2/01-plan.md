# 01 Plan

## Baseline already shipped

1. Wave 1 truth-source cutover for forum semantics and creator interaction contracts. `[completed]`
2. Wave 2 projection/UI cutover to semantic author identity/proof consumption. `[completed]`
3. Wave 3 adapter-first LLM runtime hardening and contract honesty. `[completed]`

## Residual closeout phases

1. Define and document `event target -> perceived focus -> final write anchor`. `[completed]`
2. Thread the resolved anchor through runtime preview, execution context, and response parsing. `[completed]`
3. Remove legacy flatten/telemetry anchor pollution. `[completed]`
4. Verify branch-revive end-to-end and record handoff evidence. `[completed]`

## Entry Contract

- 开工前必须接受 `T-941` 的 lifecycle/writeability/route contract 是上游真相。
- 若 `selected_anchor_turn_id`、`actual_anchor_turn_id`、allowed actions、route constraints 的语义还没有稳定名称，本包先做语义冻结，不跳过到代码落地。

## Detailed Steps

- Inventory every place that still uses `ctx.targetThreadTurn` or equivalent as a merged concept.
- Define the single resolved-anchor derivation path that downstream writer logic must consume.
- Update runtime preview/context assembly so the resolved anchor is first-class all the way into final write instruction generation.
- Remove any fallback that writes `thread.id` into `anchor_turn_id`; if root fallback is still needed, it must use a different field or explicit null semantics.
- Enrich runtime serialization with the minimum perception payload needed for:
  - why the agent is here
  - which actions are allowed
  - which route constraints apply
- Add branch-revive regression coverage that compares:
  - selected anchor
  - actual anchor
  - final write anchor
- Define the selected-vs-actual-anchor mismatch metric and record it as verification evidence.

## Handoff Review Before Next Pack

- 在 `T-947` / `T-942` / `T-949` 使用“沿点回复”“回到旧分支继续说”叙事前，必须 review：
  - event target / perceived focus / final write anchor triad 是否已完全分离
  - runtime serialization 是否携带 browse reason、allowed actions、route constraints、visible scope hints
  - mismatch metric 是否足以暴露 selected-vs-actual drift
- review 输出必须落到：
  - `03-implementation-notes.md`：resolved-anchor contract note
  - `04-verification.md`：branch-revive e2e + mismatch metric evidence

## Stop / Escalation Conditions

- 若 writer path 仍把 `ctx.targetThreadTurn` 当成三种语义的合并真相，本包不得交付。
- 若 root fallback 仍通过把 `thread.id` 塞进 `anchor_turn_id` 才能运行，则视为语义污染未清除。

## Exit Criteria

- Acceptance criteria in `00-overview.md` are all satisfied.
- Shipped convergence waves remain untouched unless directly required by anchor-truth closure.
- Verification evidence is recorded in `04-verification.md` for the residual closeout path.
