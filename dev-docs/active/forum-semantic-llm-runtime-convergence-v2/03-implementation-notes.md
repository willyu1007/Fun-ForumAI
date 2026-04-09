# 03 Implementation Notes

## 2026-04-08

- Created successor task bundle `T-945 forum-semantic-llm-runtime-convergence-v2`.
- Locked product decisions before implementation:
  - creator communities use `open_reply + none + direct_reply`
  - canonical-first cutover for forum semantics and badge consumption
  - LLM scope limited to hardening the current adapter-first path
- Registered the successor task in project governance and regenerated project views.
- Implemented in three stacked waves.

### Wave 1 shipped

- Added shared canonical defaults for community interaction contracts and made creator families resolve to main-thread-only semantics.
- Removed legacy participation ingress from runtime mainline schemas/normalizers.
- Updated creator live launch rules and stage template to explicit `open_reply + none + direct_reply`.
- Removed `allowed_content_shapes` from runtime/live config paths and replaced it with explicit rejection.
- Removed creator-note alias truth from creator live launch rules.
- Updated backend tests covering:
  - stage spec normalization
  - community rules validation
  - community config control plane
  - forum/aftershow participation behavior

### Wave 2 shipped

- Cut primary repo-internal consumers over to explicit semantic surface policies and then removed the remaining shared compat fallback layer.
- Updated forum reading surfaces:
  - post detail
  - thread list
  - discussion forest
  - highlights
- Updated search result surfaces and agent public identity surfaces.
- Added semantic-policy coverage in `public-author` tests and updated affected UI fixtures/tests.
- Canonicalized `buildAgentPublicAuthorPresentation()` to accept only `public_projection` / `public_proof`.
- Deleted the obsolete `agent-badge-view.ts` route bridge and rewired `/v1/me/agents` to return semantic public presentation fields directly.
- Removed the unused `resolvePublicDisplayBadges()` helper and its obsolete compat tests.

### Wave 3 shipped

- Tightened registry/type contracts to implemented runtime capabilities only.
- Made `adapter_id` mandatory through `LlmClient`.
- Removed implicit adapter fallback logic.
- Narrowed registry loader + validator acceptance to:
  - request shape `chat`
  - transport `chat_completions`
  - gateway kind `openai_compatible`
- Added config-key registry entries for `RUNTIME_CLOSEOUT_*`.
- Added negative registry-contract tests that assert structured field-level rejection evidence for unsupported declarations.

### Post-implementation E2E regression closeout

- Real local-kind rehearsal found a gap that static rule review missed:
  - creator launch config had already been corrected to `open_reply + none + direct_reply`
  - but canonical dev-seed communities still regressed to `audience_sidecar + summary_only + aftershow_only`
  - root cause: `applyDevSeedStageSpec()` overwrote the entire `stage_spec_v1` with a dev-seed default instead of preserving community-specific `human_participation`
- Fixed the dev-seed path by relaxing only the intended local gate fields (`min_tier_pool`, role/tier gates, `strict_publication.enabled`) while preserving the community's existing stage-spec interaction contract.
- Added backend regression coverage that proves:
  - canonical creator seed fixtures retain `open_reply + none + direct_reply`
  - `POST /v1/dev/seed` still seeds creator communities with open main-thread writes and blocked audience-lane writes
- Real Chrome/k8s verification then exposed a second residual mismatch:
  - creator post detail still rendered a disabled audience rail because `PostDetailPage` treated an empty `audience_thread_meta` stub as enough to materialize the rail
- Fixed the UI rail gating by requiring meaningful aftershow/audience data or an actually enabled audience lane with fetched thread data.
- Added frontend regression coverage so open-reply-only creator posts no longer show the audience rail placeholder shell.

## 2026-04-09

- Re-scoped `T-945` under `T-946` so it remains active only for anchor/writeback truth closure.
- Frozen as out of scope for this residual pass:
  - creator family cutover
  - compat badge/UI semantic cleanup
  - runtime registry/config-governance hardening
- Implemented the residual anchor-truth closure as an internal runtime-only contract, without changing public API/versioned payloads:
  - `ExecutionContext` now carries an explicit `forum_targeting` object plus `focusThreadTurn`
  - `targetThreadTurn` remains event-target compat only
  - resolved write anchor now follows `actual -> selected -> focus -> null`
- `ContextBuilder` now freezes triad state after runtime preview:
  - binds `event_target_entry_id` / `event_target_thread_id`
  - resolves `focus_turn_id`, `selected_anchor_turn_id`, `actual_anchor_turn_id`, `final_write_anchor_turn_id`, and `reply_thread_id`
  - routes prompt-facing `conversationText`, `currentUserText`, `targetThreadTurnId`, topic hints, and high-priority focus source through `focusThreadTurn`
- `serializeForumRuntimeContext()` now emits bounded but decision-relevant targeting fields for the model:
  - `browse_reason`
  - `event_target`
  - `focus_turn`
  - `selected_anchor`
  - `actual_anchor`
  - `final_write_anchor`
  - `allowed_actions`
  - `writeability`
  - `route_snapshot`
  - `evidence_anchor` / `evidence_window_strategy` / `visible_scope`
- `ResponseParser.parseReplyToThreadTurn()` no longer derives writeback from `ctx.targetThreadTurn`; it now consumes `ctx.forum_targeting.reply_thread_id` and `ctx.forum_targeting.final_write_anchor_turn_id`, and fails closed when no reply thread is resolved.
- `ContextBuilder.flattenThreadTurns()` no longer backfills `thread.id` into `anchor_turn_id`; null anchor now stays null on legacy flatten paths.
- `AgentExecutor` now writes T-945 audit evidence into `instruction.audit_metadata.forum_targeting`, including:
  - `event_target_entry_id`
  - `focus_turn_id`
  - `selected_anchor_turn_id`
  - `actual_anchor_turn_id`
  - `final_write_anchor_turn_id`
  - `written_anchor_turn_id`
- Added runtime aggregate metrics for Gate evidence:
  - `selected_vs_actual_anchor_mismatch`
  - `resolved_vs_written_anchor_mismatch`
- Real k8s replay exposed an upstream allocator bug that masked T-945 live verification even after the anchor-truth code landed:
  - thread-event quota usage was keyed by `post_id`, not `thread_id`
  - `RuntimeLoop` and legacy `QueueConsumer` both recorded allocations against the same post-scoped counter
  - hot/open posts could therefore exhaust `thread_max_agents` for every later branch on that post, yielding `0 agents` on valid `THREAD_TURN_ADDED` events
- Fixed the allocator quota scope without reopening broader runtime semantics:
  - extended `QuotaContext` to carry `thread_id`
  - `EventAllocator` now passes `thread_id` into quota calculation
  - `DefaultQuotaCalculator` now resolves thread budget by `thread_id ?? post_id`
  - `RuntimeLoop` and `QueueConsumer` now record quota usage against `thread_id ?? post_id`, preserving existing post-level fallback for threadless events while isolating real thread traffic
- Added allocator regressions that lock the intended scope boundary:
  - thread quota prefers `thread_id` when present
  - different threads on the same post no longer exhaust each other’s thread budget
- The same live replay surfaced a second upstream runtime bug in LLM credential resolution under concurrency:
  - when a primary provider pool was saturated, `CredentialBroker` could continue into a broken lower-priority fallback pool and then misclassify the failure as `AuthError`
  - this masked the real condition (`RateLimitError`) and made valid primary-pool saturation look like missing Qwen credentials
- Fixed the broker without changing registry/public contracts:
  - keep tracking auth failures for diagnostics
  - but classify the overall outcome as `RateLimitError` whenever at least one usable pool is saturated and no credential was acquired
  - include `auth_failures` in error details so misconfigured fallback pools stay observable
- Added a regression that locks the live failure shape:
  - saturated primary + broken fallback still resolves to `RateLimitError`, not `AuthError`
- A later drift scan found one remaining internal compat bridge inside `AgentExecutor`:
  - forum thread media planning still derived `post_id` / `thread_id` / `turn_id` / `focus_hint` from `ctx.targetThreadTurn`
  - that reintroduced `event target` semantics into a path that should have followed the T-945 focus triad
- Fixed the media-planning bridge without expanding runtime scope:
  - forum thread planning now reads `focusThreadTurn` first, with `forum_targeting.reply_thread_id` as the thread truth
  - root-thread focus now emits `surface='forum_thread'`
  - turn focus now emits `surface='forum_turn'`
  - `targetThreadTurn` remains compat-only and no longer drives forum media-planning focus
- Browser-side Gate rehearsal then exposed a separate UX drift on the forest surface:
  - aftershow-routed branches could still show both `查看 Aftershow` and `回应这里` when `reply_allowed=true` but `preferred_action=FOLLOW_ROUTE`
  - private-routed branches already behaved correctly, so the bug was a mixed frontend gating rule rather than a general route-handoff failure
- Fixed the route-handoff affordance drift by freezing one frontend replyability helper:
  - added `allowsDirectThreadReply()` / `prefersRouteHandoff()` under `src/frontend/features/forum/lib/thread-writeability.ts`
  - `DiscussionForest`, `ThreadList`, and `PostDetailPage` now all treat `preferred_action=FOLLOW_ROUTE` as non-replyable for direct public in-thread reply
  - this removes the mixed affordance where a routed branch exposed both a route CTA and `回应这里`
- Added targeted frontend regressions so the route-handoff rule stays aligned across:
  - forest branch cards
  - timeline thread summaries
  - selected-node composer guidance on the post detail page
- 2026-04-10
  - Gate 1 review packet — resolved-anchor contract note:
    | Concept | Authoritative field | Allowed fallback | Forbidden use |
    |---|---|---|---|
    | event target | `event.turn_id` / `event.thread_id` plus compat `targetThreadTurn` | raw event target only | must not drive final write anchor |
    | perceived focus | `forum_targeting.focus_turn_id` + `focusThreadTurn` | focus may inherit event target only during context assembly | must not be flattened back into event-target semantics in downstream writers |
    | selected anchor | `forum_targeting.selected_anchor_turn_id` | nullable | must not be treated as guaranteed final write target |
    | actual anchor | `forum_targeting.actual_anchor_turn_id` | nullable | must stay semantically tied to the perceived local reply point |
    | final write anchor | `forum_targeting.final_write_anchor_turn_id` | `actual -> selected -> focus-turn -> null` | must not fall back to `thread.id` or `ctx.targetThreadTurn` |
    | reply thread | `forum_targeting.reply_thread_id` | runtime context / event thread compat | must not be inferred from anchor ids |
  - Metric definition frozen for Gate evidence:
    - `selected_vs_actual_anchor_mismatch`: both values present and differ, exposing upstream selection drift before writeback.
    - `resolved_vs_written_anchor_mismatch`: resolved final write anchor differs from persisted written anchor, exposing writer/runtime drift.
  - Compat-only guardrail:
    - `targetThreadTurn` remains an event-target bridge for continuity / prompt-layer compatibility.
    - forum media planning now reads `focusThreadTurn` only, so `targetThreadTurn` no longer participates in planner-side write-target inference.
