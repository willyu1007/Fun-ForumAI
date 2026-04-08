# 00 Overview — forum-semantic-llm-runtime-convergence-v2 (T-945)

## Status

- State: in-progress
- Depends on: `T-144`, `T-145`, `T-901`, `T-937`, `T-940`
- Current status: all three implementation waves shipped; follow-up cleanup closed the remaining audience read-side stub path, removed repo-internal active compat badge consumers, collapsed the shared frontend author helper layer to semantic-only reads, deleted obsolete forum badge helper files, deleted the stale `agent-badge-view` route bridge, removed the dead `resolvePublicDisplayBadges` helper, canonicalized `buildAgentPublicAuthorPresentation()` to semantic inputs, and renamed orchestration cutover fallback away from `legacy` terminology.
- Next step: keep `T-945` as the active evidence bundle until archive/handoff; if future follow-up happens, start from the post-read/audience-stub, semantic-helper, and semantic-fixture notes recorded in `05-pitfalls.md`.

## Goal

Close the still-real convergence gaps across forum semantics, creator participation, badge surface consumption, and LLM runtime boundary honesty.

- creator communities must behave as `open_reply` main-thread products
- runtime/mainline forum semantics must accept canonical truth only
- main UI surfaces must consume semantic author identity/proof instead of compat wrappers
- LLM runtime must stay adapter-first while contracts/registry only advertise what is actually implemented

## Non-goals

- Do not introduce a new public API version.
- Do not implement a second real LLM transport or native provider runtime.
- Do not preserve creator audience-lane writing as a hidden secondary product mode.
- Do not rewrite or reopen the historical `T-937` task bundle.

## Locked decisions

- `creator-recommendation` and `creator-relationship` both switch to `open_reply`.
- Creator communities use `main-thread only`:
  - `public_participation_mode=open_reply`
  - `audience_signal_ingestion=none`
  - `agent_human_response_mode=direct_reply`
- This task is `canonical-first now`.
- `/v1` compat badge fields may remain only as derived read bridges while repo-internal primary consumers are cut over.
- LLM scope is `harden current path`, not multi-transport expansion.

## Acceptance Criteria

- [x] Runtime forum semantics accept canonical participation fields only; legacy participation keys are removed from mainline parser/normalizer paths.
- [x] Creator live rules, stage template, and proposal/community skeleton all resolve to `open_reply + none + direct_reply`.
- [x] Runtime/config no longer use or write `allowed_content_shapes`; `authoring_shapes` is the only live field.
- [x] Launch creator-note live rules no longer carry legacy alias template truth; canonical creator-note registry is the single runtime source.
- [x] Main forum/search/agent surfaces no longer depend on compat badge wrappers by default; they use semantic selectors or explicit surface policy.
- [x] `display_badges` / `badges` in `/v1` remain derived compat-only fields if still present.
- [x] LLM execution remains adapter-first, registry/contracts only advertise implemented runtime shapes, and config-key registry checks pass.
