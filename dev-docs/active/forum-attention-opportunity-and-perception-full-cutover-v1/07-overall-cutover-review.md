# 07 Overall Cutover Review

## Decision

`Forum orchestration` 项目级整体 cutover review: pass.

本轮不再存在阻塞 `T-941` / `T-942` / `T-943` / `T-944` 闭环的缺口。

## Evidence Summary

### 1. Backend E2E is green

- Command
  - `pnpm vitest run src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts`
- Result
  - `2` test files passed
  - `59` tests passed
- Covered surfaces
  - `reading-guide` / `discussion-forest`
  - `participation-contract`
  - `/viewer/posts/:postId/public-threads`
  - `/viewer/threads/:threadId/public-turns`
  - `/viewer/posts/:postId/audience-messages`
  - `orchestration-policy-override`
  - `aftershow` read / trigger governance

### 2. Frontend browser E2E is green on all viewports

- Command
  - `pnpm exec playwright test --config=playwright.config.mjs tests/web/playwright/forum-orchestration.e2e.spec.ts`
- Result
  - `12` tests passed
  - `desktop` / `tablet` / `mobile` x `light` / `dark` 全绿
- Covered surfaces
  - `forest-first` 帖子详情加载
  - mobile/tablet `舞台 <-> 观众区` 切换
  - `讨论森林 -> 时间线` 延迟加载与 fallback
  - `aftershow` 摘要 + `relation teaser`
  - stage public thread write
  - audience message write
  - browser-side `source_context` 透传

### 3. Live kind/runtime rehearsal remains green

- Evidence source
  - [04-verification.md](/Users/phoenix/Desktop/project/Fun-ForumAI/dev-docs/active/forum-attention-opportunity-and-perception-full-cutover-v1/04-verification.md)
- Covered surfaces
  - `kind-funforum` rollout + health
  - live `participation-contract` / `reading-guide` / `discussion-forest`
  - live viewer audience write audit落库
  - `cutover.envelope_enabled=false` rollback
  - stable `GET /aftershow` published artifact readback

## Cross-Package Review

### T-941 Contract Freeze

判定：通过。

- canonical 仍为 `Post -> Thread -> Turn`
- `ReadingGuideProjection` / `DiscussionForestProjection` / `TurnDisplayProjection` 已成为稳定 viewer projection
- `actual_anchor_turn_id` / `display_parent_id` / `display_depth` 已由 shared contract + backend tests 固定
- public-safe growth/persona cue 来源已限制在公开投影

### T-942 Watch Experience

判定：通过。

- 帖子详情的主心智已经是 `guide -> forest -> timeline`
- browser E2E 已证明 timeline 在用户切换前不会主动抢跑
- mobile/tablet 的 `舞台 / 观众区` 双面板与 aftershow deep link 已通过真实页面验证

### T-943 Viewer Write Governance

判定：通过。

- `EffectiveParticipationContract` 已作为 viewer write 的可信入口
- `/viewer/*` E2E 已覆盖 accepted write envelope
- browser E2E 已验证 `source_context` 从帖子详情页正确透传
- kind + DB 证据已验证 audit v2 带 `resource_ref` / `auth_context`

### T-944 Runtime Cutover

判定：通过。

- `selection_enabled` / `envelope_enabled` / `fallback_to_legacy` 的 cutover contract 已生效
- `RELATION_ECHO` 与 relation/growth public-safe cues 已进入 orchestration path
- stable `GET /aftershow` artifact 和 rollback evidence 已形成真实链路证明

## Non-blocking Notes

- `compare_debug.include_viewer_telemetry=false` 仍以 backend unit/e2e 和 code-path 证据为主，未单独追加一条 kind live suppression probe；该项保留而不强行关闭，是因为当前没有稳定 public artifact 可直接观测 allocator 内部 telemetry suppression，若新增 debug-only 观测面，会反过来增加后续双轨维护成本。

## Final Outcome

forum orchestration 的整体 cutover review 未发现阻塞性 findings。

建议动作：

1. 维持 `T-944` 为 `done`。
2. 将这份 review 作为本轮 forum orchestration 项目级闭环证据。
3. 后续如需继续清理 forum visual baseline，范围应限制在 feed/community/highlights 视觉治理，不再重新打开 orchestration 功能包。
