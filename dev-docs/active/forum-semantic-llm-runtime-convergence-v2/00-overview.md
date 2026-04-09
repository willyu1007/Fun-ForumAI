# 00 Overview — forum-semantic-llm-runtime-convergence-v2 (T-945)

## Status

- State: in-progress
- Depends on: `T-144`, `T-145`, `T-901`, `T-937`, `T-940`
- Current status: the original three convergence waves remain shipped and frozen; the residual anchor-truth closure is now implemented and Gate 1 review packet is assembled, with `forum_targeting` carrying write-target truth and `targetThreadTurn` reduced to event-target compat semantics only.
- Next step: keep the triad stable for `T-947` / `T-942`; any later need to reinterpret focus or writeback semantics must be adjudicated in `T-946` before reopening this package.

## Goal

Close the remaining real convergence gaps across forum runtime truth without reopening already-shipped creator/badge/registry work.

- selected/perceived/write anchor must resolve to one stable writeback truth
- runtime/mainline forum semantics must keep canonical anchor semantics all the way to final write instruction
- legacy flatten/telemetry paths must stop borrowing `anchor_turn_id` as a root fallback
- runtime serialization / perception consumption must expose enough context for the model to understand why it is here, what it can do, and where it should reply

## Non-goals

- Do not introduce a new public API version.
- Do not implement a second real LLM transport or native provider runtime.
- Do not rewrite or reopen the historical `T-937` task bundle.
- Do not reopen already-shipped creator/badge/runtime-registry scope unless a regression is directly caused by the anchor-truth closure work.

## Locked decisions

- `creator-recommendation` and `creator-relationship` both switch to `open_reply`.
- Creator communities use `main-thread only`:
  - `public_participation_mode=open_reply`
  - `audience_signal_ingestion=none`
  - `agent_human_response_mode=direct_reply`
- This task is `canonical-first now`.
- `/v1` compat badge fields may remain only as derived read bridges while repo-internal primary consumers are cut over.
- LLM scope is `harden current path`, not multi-transport expansion.
- The active residual scope of `T-945` is forum runtime truth closure; other convergence waves stay frozen and are not reopened.

## Acceptance Criteria

- [x] Runtime forum semantics accept canonical participation fields only; legacy participation keys are removed from mainline parser/normalizer paths.
- [x] Creator live rules, stage template, and proposal/community skeleton all resolve to `open_reply + none + direct_reply`.
- [x] Runtime/config no longer use or write `allowed_content_shapes`; `authoring_shapes` is the only live field.
- [x] Launch creator-note live rules no longer carry legacy alias template truth; canonical creator-note registry is the single runtime source.
- [x] Main forum/search/agent surfaces no longer depend on compat badge wrappers by default; they use semantic selectors or explicit surface policy.
- [x] `display_badges` / `badges` in `/v1` remain derived compat-only fields if still present.
- [x] LLM execution remains adapter-first, registry/contracts only advertise implemented runtime shapes, and config-key registry checks pass.
- [x] runtime preview / execution context / final write instruction share the same resolved anchor path instead of drifting back to `ctx.targetThreadTurn`.
- [x] `event target`、`perceived focus`、`final write anchor` 三分语义在代码和 handoff 文档里显式分离。
- [x] legacy flatten / telemetry output no longer reuses `anchor_turn_id` as a root fallback field。
- [x] branch-revive regression evidence proves the final reply lands on the selected actual anchor.
- [x] runtime serialization 稳定暴露 browse reason、selected anchor、actual anchor、allowed actions、route constraints 等感知上下文，而不回退到全量 thread 载荷。
- [x] perception/runtime 对 allowed actions / route handoff 的消费与 lifecycle / participation contract 保持一致。
- [x] selected-vs-actual-anchor mismatch 有稳定监控口径，可作为后续 gate evidence。
