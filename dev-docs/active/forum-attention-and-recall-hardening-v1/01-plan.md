# 01 Plan

## Phases

1. Phase A: freeze upstream semantics from `T-945` and `T-943`. `[pending]`
2. Phase B: make broker consume forest/local branch structure. `[pending]`
3. Phase C: harden recall scope, decay, and quota separation. `[pending]`
4. Phase D: add telemetry, regression coverage, and closeout evidence. `[pending]`

## Entry Contract

- 开工前必须读取并接受：
  - `T-945` 的 resolved-anchor / runtime truth
  - `T-943` 的 viewer write-plane side-effect truth
  - `T-941` 的 lifecycle/projection vocabulary
- 若 Phase 1 仍存在 anchor/write-plane 语义漂移，本包只能先写 broker/recall decision matrix，不能冻结最终策略实现。

## Detailed Steps

- Inventory current broker shortcuts:
  - `selected_anchor_turn_id` fallback order
  - coarse source resolution
  - branch-level metrics
- Define the minimum local-structure signals broker must consume:
  - focus branch
  - actual anchor
  - recent visible node set
  - late-entry / newcomer / audience-push evidence
- Re-scope pair windows so suppression is at least thread-local.
- Turn `reactive_recall_decay` into executable policy with clear defaults and tests.
- Separate incumbent loop suppression from outsider/newcomer budget so the same knob does not silently govern two unrelated behaviors.
- Record compare/debug telemetry in a way that can be consumed by later observability work without introducing a new product contract.
- Define the director-quality metric dictionary for:
  - spontaneity
  - branch entropy
  - duel risk
  - newcomer / revive / audience-push ratios

## Handoff Review Before Next Pack

- 在 `T-942` / `T-948` / `T-949` 消费导演层结论前，必须 review：
  - broker 是否真正使用 local branch / visible node set / source evidence
  - recall 是否已切到 thread-local 或更细粒度作用域
  - decay / quota / telemetry dictionary 是否冻结
- review 输出必须落到：
  - `03-implementation-notes.md`：broker/recall policy matrix
  - `04-verification.md`：thread A vs thread B、old-branch revive、audience spike evidence

## Stop / Escalation Conditions

- 若 broker 仍主要靠 latest-turn fallback 做分支选择，本包不得交付给 UX 或性能包消费。
- 若 recall 抑制仍会跨 thread 泄漏，本包不得宣称“活人感”问题已进入 UI 调优阶段。

## Exit Criteria

- `00-overview.md` acceptance criteria are satisfied.
- Broker/recall tests cover at least:
  - same pair across two threads
  - old-branch revive
  - audience spike with a non-latest local target
- decision telemetry is recorded in `04-verification.md`.
