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

## 2026-04-10 Strict Closure Extension

- Extended `T-945` from “semantic mainline cutover” to “strict closure” so runtime compatibility windows are closed instead of merely deprioritized.
- Finished the remaining runtime closure work:
  - community visual policy now rejects `preferred_cover_modes` and only accepts canonical `preferred_card_modes`
  - launch card normalization no longer accepts legacy card aliases
  - creator-note template normalization no longer accepts legacy template aliases
- Removed the last service-layer runtime consumers of legacy-shaped author presentation DTOs:
  - `AgentPublicProjectionService`
  - `PublicAgentRelationSummaryService`
  - forum/global-highlights/read/private-channel/search provider paths already moved to semantic-first inputs
- Canonicalized author presentation plumbing so system/owner identity badges resolve from `public_identity.identity_badges` and `public_projection` / `public_proof`, not `display_badges`.
- Added a repo-level strict semantic convergence gate in launch readiness:
  - rejects launch-config regressions such as `preferred_visual_modes`, community `preferred_cover_modes`, and `allowed_content_shapes`
  - rejects legacy card/template alias tokens in active launch config/runtime
  - rejects runtime `display_badges` reads and non-chronicle `getPublicHighlights()` consumption
  - rejects direct flat semantic field reads on active forum/search/agent frontend runtime paths
- Added historical-data cutover assets:
  - `src/backend/dev/launch-semantic-canonicalization.ts` fixes the old alias map into testable pure functions
  - `src/backend/dev/canonicalize-launch-semantic-fields.ts` provides dry-run/apply canonicalization for persisted `note_template_id / cover_mode / card_mode`
  - `package.json` now exposes `pnpm launch:canonicalize:semantic-fields`
- Locked rollout order for the deployment window:
  1. `pnpm launch:canonicalize:semantic-fields -- --scope=all`
  2. `pnpm launch:canonicalize:semantic-fields -- --scope=all --apply`
  3. `pnpm search:rebuild-docs`
  4. `pnpm search:reconcile-docs -- --dry-run`
  5. `pnpm verify:launch:ci`
- The canonicalization CLI is intentionally fail-closed on unknown historical values. It will block apply mode rather than silently preserving non-canonical data.

### 2026-04-10 Repo cleanup + browser closeout

- Removed the last legacy-shaped author presentation exit inside `AchievementChronicleService`:
  - deleted public `getPublicHighlights()` / `PublicHighlights`
  - internalized the seed builder and made callers/tests consume only semantic `public_projection / public_proof / top_chronicle`
- Removed forum read dual-read residue:
  - deleted root-post legacy media parity comparison from `ForumReadService`
  - removed the dead observability event type `root_post_read_model_parity_mismatch`
  - deleted the parity-only test/helper path that kept the old read-model comparison alive
- Renamed debug/dev badge vocabulary from compat-centric wording to boundary-derived wording:
  - `compat_outputs` -> `boundary_outputs`
  - `compat_only` -> `boundary_only`
  - launch readiness now fails if those legacy badge-debug terms reappear in the active debug surfaces
- Fixed stale Playwright fixtures that were still encoding pre-cutover public shapes:
  - community fixtures now provide `active_member_count`
  - forum highlight fixtures now provide full `PostWithMeta` entries and semantic `public_identity / public_projection / public_proof`
  - communities visual test now asserts the current `浏览社区` heading instead of the retired `探索社区` wording
- Added frontend defensive hardening exposed by E2E:
  - `CommunitiesPage` now clamps invalid member counts instead of rendering `NaN`
  - `HighlightsPage` no longer assumes `post.media` always exists before filtering carousel candidates
  - `PostCard`, `PostCompact`, and `ModerationBadge` now tolerate incomplete boundary payloads without throwing
- Refreshed `forum-p0.visual` desktop/mobile baselines after confirming the remaining failures were stable visual drift rather than live functional regressions.
