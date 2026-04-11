# 04 Verification

## Baseline checks — 2026-04-11

- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - result: pass
- `pnpm typecheck`
  - result: pass
- `pnpm lint`
  - result: pass
- `pnpm ui:build`
  - result: pass
- `pnpm ui:check`
  - result: pass
- `pnpm ui:validate`
  - result: pass
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
  - result: fail
  - note: 100 errors, concentrated in `FeedbackPage`, `SafetyCenterPage`, `ChatRoomHoldSurface`, `DiscussionForest`, and `HelpMarkdown`
- `pnpm test`
  - result: fail
  - note: `src/backend/routes/__tests__/e2e-community-config-control-plane.test.ts` expected admin apply `200`, received `401`
- `pnpm build`
  - result: pass
- `pnpm ui:bundle:check`
  - result: pass
- `pnpm db:validate`
  - result: pass
- `pnpm mobile:typecheck`
  - result: pass
- `pnpm mobile:test`
  - result: pass
- `pnpm mobile:config:check`
  - result: pass
- `pnpm mobile:smoke:validate`
  - result: fail
  - note: missing `dev-docs/archive/ios-android-runtime-smoke-kit/06-operator-guide.md`
- `pnpm verify:launch:ci`
  - result: pass
- `pnpm test:e2e:playwright`
  - result: fail
  - note: broad visual regression drift across agent modal, forum, governance/auth, and realtime suites
- `node ops/packaging/scripts/build.mjs --target llm-forum --tag llm-forum:ci-validate --build-profile launch`
  - result: pass

## Cutover checks

- `pnpm cutover:preflight`
  - result: pass
  - note: findings reduced from `79` to `0`; live flag markers, live legacy markers, and live Prisma metadata-field markers are all cleared from the current runtime/schema surface
- `pnpm cutover:metadata:inventory -- --output-dir .ai/.tmp/database/manual-inventory-check`
  - result: pass
  - note: inventory written to `.ai/.tmp/database/manual-inventory-check/flag-metadata-legacy-inventory.{json,md}` against `llm_forum_dev`
- backend launch capability cutover
  - result: pass
  - note: live runtime no longer references `config.features`; frontend/mobile/backend env flag pins were removed from active runtime and deploy overlays
- `pnpm exec prisma validate`
  - result: pass
- community-config metadata cutover
  - result: pass
  - note: `CommunityConfigVersion.metaJson` and `CommunityConfigPatch.metaJson` were replaced with explicit fields in `prisma/schema.prisma`, repositories, services, frontend API types, and tests
- legacy schema removal
  - result: pass
  - note: `LegacyAgentMediaAsset`, `LegacyGrowthEventArchive`, and their schema relations are removed from live Prisma schema; local inventory already showed both tables had `0` rows
- `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --output .ai/.tmp/database/flag-metadata-legacy-cutover-preview/community-config-and-legacy-cutover.sql`
  - result: pass
  - note: preview generated at `.ai/.tmp/database/flag-metadata-legacy-cutover-preview/community-config-and-legacy-cutover.sql`; it also surfaces pre-existing unrelated DB/schema drift (`community_proposals.t4_candidate`, `incubation_jobs.strict_t4`, `viewer_public_view_events.is_t4`)
- `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
  - result: pass
  - note: refreshed `docs/context/db/schema.json`
- achievement/signal context cutover
  - result: pass
  - note: `AgentAchievement.metaJson` was replaced by explicit `signal_context` + `award_context` fields, and `AgentSignalLog.metaJson` was replaced by explicit `scope` plus typed signal-context fields in Prisma, repositories, orchestrator wiring, and API types
- `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --output .ai/.tmp/database/flag-metadata-legacy-cutover-preview/achievement-and-signal-context-cutover.sql`
  - result: pass
  - note: preview generated at `.ai/.tmp/database/flag-metadata-legacy-cutover-preview/achievement-and-signal-context-cutover.sql`
- chronicle context cutover
  - result: pass
  - note: `ChronicleEntry.metaJson` was replaced by explicit `scope`, typed signal-context fields, typed story-context fields, and explicit compaction-source fields in Prisma, repositories, story-meta readers, orchestrator wiring, nightly maintenance, API types, and affected tests
- `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --output .ai/.tmp/database/flag-metadata-legacy-cutover-preview/chronicle-context-cutover.sql`
  - result: pass
  - note: preview generated at `.ai/.tmp/database/flag-metadata-legacy-cutover-preview/chronicle-context-cutover.sql`
- media lineage context cutover
  - result: pass
  - note: `MediaLineageEdge.metadataJson` was replaced by explicit lineage columns in Prisma, repositories, runtime media services, the lineage dedupe path, and the media-lineage backfill script
- `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --output .ai/.tmp/database/flag-metadata-legacy-cutover-preview/media-lineage-context-cutover.sql`
  - result: pass
  - note: preview generated at `.ai/.tmp/database/flag-metadata-legacy-cutover-preview/media-lineage-context-cutover.sql`
- audience/aftershow context cutover
  - result: pass
  - note: `AudienceSummary.metaJson`, `AftershowRun.metaJson`, `AftershowArtifact.metaJson`, and `AftershowCallout.metaJson` were replaced by explicit source/safe-mode, run outcome, artifact publish, and callout fields across Prisma, repositories, the aftershow service, read API types, and frontend/test fixtures
- `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --output .ai/.tmp/database/flag-metadata-legacy-cutover-preview/aftershow-audience-context-cutover.sql`
  - result: pass
  - note: preview generated at `.ai/.tmp/database/flag-metadata-legacy-cutover-preview/aftershow-audience-context-cutover.sql`
- governance/role-assignment context cutover
  - result: pass
  - note: `CommunityProposal.metaJson`, `CommunityMergeRecommendation.metaJson`, and `RoleAssignment.metaJson` were replaced by explicit action/dependency fields, typed recommendation decision context, and explicit role-assignment action reason fields across Prisma, repositories, governance services, validation, API types, and tests
- `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --output .ai/.tmp/database/flag-metadata-legacy-cutover-preview/governance-role-assignment-context-cutover.sql`
  - result: pass
  - note: preview generated at `.ai/.tmp/database/flag-metadata-legacy-cutover-preview/governance-role-assignment-context-cutover.sql`
- incubation context cutover
  - result: pass
  - note: `IncubationJob.metaJson`, `IncubationGrant.metaJson`, and `IncubationSourceBundle.metaJson` were replaced by explicit job source/review/publication fields and explicit source-bundle origin fields across Prisma, repositories, orchestration, forum publish flow, and tests
- `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --output .ai/.tmp/database/flag-metadata-legacy-cutover-preview/incubation-context-cutover.sql`
  - result: pass
  - note: preview generated at `.ai/.tmp/database/flag-metadata-legacy-cutover-preview/incubation-context-cutover.sql`
- risk-governance context cutover
  - result: pass
  - note: `UserIdentityVerification.metaJson` and `ModerationCaseTarget.metaJson` were removed from live Prisma schema, repository DTOs, API types, and affected fixtures because inventory showed only empty metadata buckets and no runtime caller depended on persisted metadata payload keys
- `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --output .ai/.tmp/database/flag-metadata-legacy-cutover-preview/risk-governance-context-cutover.sql`
  - result: pass
  - note: preview generated at `.ai/.tmp/database/flag-metadata-legacy-cutover-preview/risk-governance-context-cutover.sql`
- moderation context cutover
  - result: pass
  - note: `Post.moderationMetadataJson`, `RoomMessage.moderationMetadataJson`, and `PrivateMessage.moderationMetadataJson` were replaced by explicit moderation context columns plus typed repository/service contracts; participation/orchestration override writers now target explicit post-level override fields; the participation-contract backfill was rewritten to bridge legacy rows into `participation_contract_override_json` without relying on the removed Prisma field
- `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --output .ai/.tmp/database/flag-metadata-legacy-cutover-preview/moderation-context-cutover.sql`
  - result: pass
  - note: preview generated at `.ai/.tmp/database/flag-metadata-legacy-cutover-preview/moderation-context-cutover.sql`

## Focused regression checks — 2026-04-11

- `pnpm typecheck`
  - result: pass
- `pnpm exec eslint src/backend src/frontend scripts apps/mobile/src packages/ui-mobile ops/packaging --ext .ts,.tsx,.mjs,.js`
  - result: pass
- `node scripts/run-vitest.mjs run src/backend/app.test.ts src/backend/launch/__tests__/programming-contracts.test.ts src/backend/services/__tests__/persona-state-service.test.ts src/backend/routes/__tests__/guidance-api.test.ts src/backend/routes/__tests__/sse.test.ts src/backend/routes/__tests__/admin-hot-topic-api.test.ts scripts/lib/__tests__/launch-readiness.test.ts`
  - result: pass
- `node scripts/run-vitest.mjs run src/backend/routes/__tests__/e2e-community-config-control-plane.test.ts src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx`
  - result: pass
  - note: updated the community-config flow fixture to match launch-state participation/tier gates while keeping the control-plane assertions intact
- `node scripts/run-vitest.mjs run src/backend/services/__tests__/achievements-orchestrator.test.ts src/backend/services/__tests__/achievement-chronicle-service.test.ts src/backend/repos/__tests__/agent-signal-log-repository.test.ts src/backend/stage/__tests__/agent-stage-tier.test.ts`
  - result: pass
  - note: validates the `AgentAchievement` / `AgentSignalLog` typed-context cutover and the affected stage scoring surface
- `node scripts/run-vitest.mjs run src/backend/services/__tests__/achievement-chronicle-service.test.ts src/backend/services/__tests__/achievements-orchestrator.test.ts src/backend/services/__tests__/owner-life-overview-service.test.ts src/backend/stage/__tests__/agent-stage-tier.test.ts`
  - result: pass
  - note: validates the `ChronicleEntry` typed-context cutover across chronicle reads, owner-life aggregation, orchestrator writes, and stage scoring
- `node scripts/run-vitest.mjs run src/backend/media/__tests__/media-write-bridge.test.ts src/backend/media/__tests__/image-planner-service.test.ts src/backend/media/__tests__/media-projection-service.test.ts src/backend/media/__tests__/media-asset-service.test.ts src/backend/media/__tests__/media-generation-service.test.ts`
  - result: pass
  - note: validates the `MediaLineageEdge` typed-context cutover across binding/projection/planner/generation/write-bridge/media-asset flows
- `node scripts/run-vitest.mjs run src/backend/services/__tests__/aftershow-service.test.ts src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - result: pass
  - note: validates the audience/aftershow typed-context cutover across aftershow orchestration, read payload shapes, and focused frontend fixtures
- `node scripts/run-vitest.mjs run src/backend/services/__tests__/community-governance-service.test.ts src/backend/routes/__tests__/e2e-role-assignment-control-plane.test.ts src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx`
  - result: pass
  - note: validates the governance/role-assignment typed-context cutover across recommendation computation, proposal/role control-plane flows, and admin payload types
- `node scripts/run-vitest.mjs run src/backend/routes/__tests__/e2e-incubation-control-plane.test.ts src/backend/services/__tests__/incubation-orchestrator.test.ts src/backend/services/__tests__/incubation-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts`
  - result: pass
  - note: validates the incubation typed-context cutover across control-plane review/grant routes, orchestrated job/source creation, review state transitions, and post-publish job finalization
- `node scripts/run-vitest.mjs run src/backend/services/__tests__/identity-gate-service.test.ts src/backend/services/__tests__/complaint-appeal-service.test.ts src/backend/services/__tests__/forum-write-service.policy-gateway.test.ts src/backend/services/__tests__/chat-service.policy-gateway.test.ts src/frontend/features/admin/pages/admin-panel/__tests__/IdentityReviewCard.test.tsx src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx`
  - result: pass
  - note: validates the risk-governance cutover across identity review reads, moderation case-target persistence, policy-gateway case creation flows, and admin panel fixtures
- `node scripts/run-vitest.mjs run src/backend/services/__tests__/participation-contract-service.test.ts src/backend/services/__tests__/forum-orchestration-policy-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/chat-service.policy-gateway.test.ts src/backend/services/__tests__/governance-adapter.test.ts src/backend/services/__tests__/private-channel-service.test.ts`
  - result: pass
  - note: validates the final moderation-context tranche across post override persistence, orchestration override persistence, forum read projections, chat/private policy metadata, governance message moderation updates, and private-channel failure recovery paths
- `pnpm exec prisma validate`
  - result: pass
- `pnpm exec tsc -b`
  - result: pass

## Quality closure follow-up — 2026-04-11

- `pnpm exec eslint src/backend/routes/__tests__/e2e-helpers.ts src/backend/dev/backfill-participation-contract-overrides.ts src/backend/repos/pg/pg-content-moderation.ts src/backend/repos/types/moderation-context.ts src/backend/services/participation-contract-service.ts src/backend/services/forum-orchestration-policy-service.ts`
  - result: pass
- `pnpm exec prisma validate`
  - result: pass
- `pnpm cutover:preflight`
  - result: pass
  - note: still `0` findings / `0` Prisma metadata fields / `0` legacy models
- `pnpm forum:audit:participation-contract-overrides`
  - result: blocked
  - note: current local DB has not applied the new schema yet; audit exits because `posts.participation_contract_override_json` is not present. This is an environment prerequisite, not a runtime code failure.
- `node scripts/run-vitest.mjs run src/backend/services/__tests__/participation-contract-service.test.ts src/backend/services/__tests__/forum-orchestration-policy-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/chat-service.policy-gateway.test.ts src/backend/services/__tests__/governance-adapter.test.ts src/backend/services/__tests__/private-channel-service.test.ts src/backend/services/__tests__/policy-gateway-service.test.ts src/backend/services/__tests__/forum-write-service.policy-gateway.test.ts src/backend/routes/__tests__/admin-hot-topic-api.test.ts`
  - result: pass
  - note: `87` tests passed; validates the moderation-context typed surface across read/write/policy/private-channel/admin hot-topic paths
- `node scripts/run-vitest.mjs run src/backend/routes/__tests__/e2e-data-plane.test.ts`
  - result: pass
  - note: the E2E helper now provisions canonical launch prerequisites for service-auth agents (community existence, membership, and writable stage tier), so write-plane coverage is back on the launch-only path
- `node scripts/run-vitest.mjs run src/backend/routes/__tests__/admin-moderation-api.test.ts`
  - result: pass
- `node scripts/run-vitest.mjs run src/backend/routes/__tests__/e2e-read-api.test.ts`
  - result: fail
  - note: reduced from `25` failures to `2`. Remaining failures are suite-isolation issues, not confirmed runtime regressions:
    - `GET /v1/highlights returns empty` passes in isolation but fails in the full file because earlier tests now legitimately seed highlightable posts into shared in-memory state.
    - `GET /v1/posts/:postId does not block on slow rollout profile evaluation when aftershow web is enabled` passes in isolation but fails in the full file because the read-route rollout-profile cache is already warm, so the spy observes `0` calls instead of the cold-cache expectation.
- `node scripts/run-vitest.mjs run src/backend/routes/__tests__/e2e-read-api.test.ts -t "GET /v1/highlights returns empty"`
  - result: pass
- `node scripts/run-vitest.mjs run src/backend/routes/__tests__/e2e-read-api.test.ts -t "GET /v1/posts/:postId does not block on slow rollout profile evaluation when aftershow web is enabled"`
  - result: pass
- `pnpm typecheck`
  - result: pass
  - note: after the E2E helper changes, added an explicit `Promise<Response>` annotation to keep the test helper portable under `tsc -b`

## Repo-wide closure — 2026-04-11

- `node scripts/run-vitest.mjs run src/backend/routes/__tests__/e2e-read-api.test.ts`
  - result: pass
  - note: the route-level rollout-profile cache is reset between tests, the `/v1/highlights` empty assertion now explicitly tests the disabled fallback path, and the summary-first timeline contract test has a scoped `15_000ms` timeout so suite accumulation no longer trips the default `5_000ms` limit
- `pnpm mobile:smoke:validate`
  - result: pass
  - note: restored `dev-docs/archive/ios-android-runtime-smoke-kit/06-operator-guide.md`
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
  - result: pass
  - note: latest report at `.ai/.tmp/ui/20260411T041705Z-56336/ui-gate-report.md` with `0` errors / `0` warnings
- `pnpm cutover:preflight`
  - result: pass
  - note: still `0` findings / `0` Prisma metadata fields / `0` legacy models
- `pnpm exec tsc -b`
  - result: pass
- `pnpm test:e2e:playwright`
  - result: pass
  - note: `102` tests passed after stubbing `EventSource` in the visual harness, suppressing dev/test-only auth surfaces in automated browsers, adding the `/home` fallback mock, and refreshing the auth / owner-modal snapshots that had legitimately changed

## Isolated DB apply rehearsal — 2026-04-11

- connection probe against host PostgreSQL (`localhost:5432/llm_forum_dev`)
  - result: partial pass
  - note: basic connection succeeded, but host-backed migration rehearsal failed because the local Homebrew PostgreSQL 14 installation could not load `plpgsql.so` under macOS system policy
- Docker PostgreSQL 14 isolated target (`localhost:55433`)
  - result: pass
  - note: disposable container was used for the actual rehearsal
- `pnpm exec prisma migrate dev --create-only --name t952_flag_metadata_legacy_cutover`
  - result: pass
  - note: generated `/Volumes/DataDisk/Project/Fun-ForumAI/prisma/migrations/20260411043037_t952_flag_metadata_legacy_cutover/migration.sql`
- `node scripts/e2e-pg-isolated.mjs` against Docker PostgreSQL 14
  - result: pass
  - note: after the versioned migration and persistent E2E fixture/contract updates landed, the full isolated rehearsal passed end to end:
    - `pnpm db:generate`
    - `pnpm db:migrate:deploy`
    - `src/backend/routes/__tests__/e2e-read-api.test.ts` (`49/49`)
    - six persistent control-plane suites (`48/48`)
    - targeted role-assignment and aside-seats assertions
- evidence bundle
  - result: pass
  - note: retained under `/Volumes/DataDisk/Project/Fun-ForumAI/dev-docs/archive/flag-metadata-legacy-cutover/artifacts/db/isolated-db-apply-rehearsal-20260411`

## Launch readiness gate closure — 2026-04-11

- `node scripts/run-vitest.mjs run src/backend/routes/__tests__/e2e-dev-seed.test.ts`
  - result: pass
  - note: `5/5` tests passed after launch roster membership bootstrap started seeding a canonical writable stage-tier snapshot for platform-managed launch agents
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - result: pass
  - note: registered `T-953 route-controller-split-and-avatar-asset-strategy-temp`, restored the missing `T-061 ios-android-runtime-smoke-kit` task identity file, and regenerated derived project views
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - result: pass
- `pnpm verify:launch:ci`
  - result: pass
  - note: `18/18` checks passed, including launch regression tests and governance lint

## Packaging build — 2026-04-11

- `node ops/packaging/scripts/build.mjs --target llm-forum --tag llm-forum:ci-validate --build-profile launch`
  - result: pass
  - note: built and loaded local Docker image `llm-forum:ci-validate`
- `docker image inspect llm-forum:ci-validate --format '{{json .RepoTags}} {{.Id}} {{.Created}} {{.Size}}'`
  - result: pass
  - note: image id `sha256:bb8f703acb5982a6f957f4f7e446a97dabca1177c276e21f3bc300e85e3011c1`, created `2026-04-11T04:48:54.752701502Z`, content size `287137056` bytes
- `docker image ls llm-forum:ci-validate`
  - result: pass
  - note: local disk usage reports approximately `1.17GB`, content size approximately `287MB`

## Maintenance-window preflight package — 2026-04-11

- repo deploy/runbook synthesis
  - result: pass
  - note: aligned the preflight package with:
    - `ops/deploy/handbook/runbooks/deployment-mainline.md`
    - `ops/deploy/handbook/runbooks/cloud-go-live-chain.md`
    - `ops/deploy/handbook/runbooks/rollback-procedure.md`
    - `ops/deploy/vm-compose/fun-forum/deploy.sh`
    - `ops/deploy/vm-compose/fun-forum/rollback.sh`
    - `ops/deploy/vm-compose/fun-forum/smoke.sh`
- migration compatibility classification
  - result: pass
  - note: `prisma/migrations/20260411043037_t952_flag_metadata_legacy_cutover/migration.sql` contains destructive `DROP COLUMN` / `DROP TABLE` operations, so the maintenance-window plan is classified as `db_compat=incompatible`
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - result: pass
  - note: documentation updates did not introduce governance drift
