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
