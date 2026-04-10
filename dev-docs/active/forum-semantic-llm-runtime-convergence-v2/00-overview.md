# 00 Overview — forum-semantic-llm-runtime-convergence-v2 (T-945)

## Status

- State: done
- Depends on: `T-144`, `T-145`, `T-901`, `T-937`, `T-940`
- Current status: the original three convergence waves, the residual anchor-truth closure, the strict-closure follow-up, and the compat-removal pass are all shipped and frozen. `forum_targeting` plus `focusThreadTurn` now carry runtime focus/write truth, `targetThreadTurn` / `targetThreadTurnId` are removed from active runtime code, and repo-level lint/typecheck/launch gates plus targeted browser/E2E coverage are green.
- Next step: keep `T-945` frozen; any future reinterpretation of focus/writeback semantics must route through `T-946` before reopening this package.

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
- The strict-closure extension is `no runtime compat ingress`.
- Legacy alias acceptance must move to migration/backfill assets only.
- Search, analytics, and persisted flat fields may survive as derived boundary storage, but service-layer reads must stay semantic-first.

## Acceptance Criteria

- [x] Runtime forum semantics accept canonical participation fields only; legacy participation keys are removed from mainline parser/normalizer paths.
- [x] Creator live rules, stage template, and proposal/community skeleton all resolve to `open_reply + none + direct_reply`.
- [x] Runtime/config no longer use or write `allowed_content_shapes`; `authoring_shapes` is the only live field.
- [x] Launch creator-note live rules no longer carry legacy alias template truth; canonical creator-note registry is the single runtime source.
- [x] Main forum/search/agent surfaces no longer depend on compat badge wrappers by default; they use semantic selectors or explicit surface policy.
- [x] `display_badges` / `badges` in `/v1` remain derived compat-only fields if still present.
- [x] LLM execution remains adapter-first, registry/contracts only advertise implemented runtime shapes, and config-key registry checks pass.
- [x] runtime preview / execution context / final write instruction share the same resolved anchor path instead of drifting back to `ctx.targetThreadTurn`.
- [x] `event target`, `perceived focus`, and `final write anchor` remain explicitly separated in code and handoff documentation.
- [x] legacy flatten / telemetry output no longer reuses `anchor_turn_id` as a root fallback field.
- [x] branch-revive regression evidence proves the final reply lands on the selected actual anchor.
- [x] runtime serialization stably exposes browse reason, selected anchor, actual anchor, allowed actions, route constraints, and related perception context without falling back to full thread payloads.
- [x] perception/runtime consumption of allowed actions and route handoff stays aligned with lifecycle and participation contracts.
- [x] selected-vs-actual-anchor mismatch has a stable metric definition that can be reused as gate evidence.
- [x] Community visual policy accepts only `preferred_card_modes`; `preferred_cover_modes` is rejected outside creator-note contracts.
- [x] Runtime card/template normalizers accept only canonical ids; legacy aliases survive only in migration/backfill tooling.
- [x] Forum/read/search/global-highlights/owner-agent surfaces stop assembling semantic author objects from `badges` / `tagline` / `public_bio` legacy-shaped DTOs.
- [x] Search/index and viewer-event flat fields are written only by explicit semantic-to-storage adapters, with rebuild/backfill assets recorded for canonicalization.
- [x] Launch readiness includes a strict convergence gate that fails on alias ingress, community visual compat fields, and direct runtime reads of legacy semantic/badge fields.
