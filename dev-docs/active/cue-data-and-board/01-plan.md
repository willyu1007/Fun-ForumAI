# 01 Plan — T-209 cue-data-and-board

## Phases

### P-A. Recon + design lock (~0.3d)
- Confirm prisma patterns: snake_case + `@map()`, cuid IDs, JSON columns with default, Prisma enums uppercase, `@@index/@@unique/@@map`
- Confirm migration workflow: `pnpm db:migrate:dev`, then `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
- Confirm repository convention: interface in `src/backend/repos/<name>.ts`, in-memory impl side-by-side, postgres impl in `pg/` subdir, returns domain entities (no Prisma leakage)
- Confirm admin UI pattern: `AdminPageWrapper` in `AdminPages.tsx` + `<Tab>.tsx` panel + `useAdmin*` hook
- Confirm YAML import target: existing parser at `src/backend/launch/programming-schedule.ts`

### P-B. Prisma schema + migration (~1d)
- Add 6 models + 18 enums to `prisma/schema.prisma`:
  - models: `PublicDiscussionCueSchedule`, `PublicDiscussionCue`, `PublicDiscussionCueChange`, `PublicDiscussionCueMedia`, `CueExecutionAttempt`, `CommunityRuntimeLoadSnapshot`
  - enums: schedule status/source/scope, cue status/source/lane/risk, media role/strength/use-policy/validation/created-by, change type/source/approval/validation, attempt status, load state/freshness
- Cue-domain internal relations only (schedule ↔ cue ↔ media ↔ change ↔ attempt). Cross-domain refs (community, asset, user, agent, post) use plain string columns without Prisma relations to minimize blast radius on existing models.
- Indexes per expected query patterns (schedule scan, due cue scan, lease query, audit chain)
- Run `pnpm db:migrate:dev --name cue_programming_v1`
- Run `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`

### P-C. Domain types + `CuePatchV1` (~1d)
- `src/backend/programming/cue/types.ts`:
  - `CueThemeIntent` (topic_seed, discussion_question, angle_hint, tone_band, public_context_refs)
  - `CueSceneConstraints` (community_scope, public_stage_scope, allowed/preferred/disallowed scene families, tension_range, privacy_policy, private_reference_policy, safety_profile, continuity_policy, fatigue_constraints)
  - `CueRoleRequirementVector` (requirements[], relationship_shape, novelty_preference)
  - `CueMediaPolicy` envelope, `CueSafetyPolicy`
  - `PublicDiscussionCueDomain` (full domain entity returned by repository)
- Zod schemas for each above
- `src/backend/programming/cue/cue-patch.ts`:
  - `CuePatchV1Schema` (partial cue + `removed_fields[]` + `version: 1`)
  - **Forbidden-field validator** (single SSOT list mirrored from umbrella §3); both partial and removed_fields must reject the 21 forbidden field names
  - `applyCuePatch(base, patch)` helper (domain-level merge)
- `src/backend/programming/cue/permissions.ts` — placeholder permission strings list (T-210 implements the auth gate; this file just defines the constants so registry is fixed at frozen-fields time)

### P-D. Cue repository (~1d)
- `src/backend/repos/cue-repository.ts` — interface + in-memory impl:
  - schedule: `createSchedule`, `findScheduleById`, `findActiveScheduleForScope`, `updateScheduleStatus`
  - cue: `createCue`, `updateCue`, `findCueById`, `listCuesForSchedule`, `listUpcomingCues`
  - change: `recordChange`, `listChangesForCue`, `listChangesForSchedule`
  - media: `attachMedia`, `removeMedia`, `listMediaForCue`
  - attempt: stub methods (write paths used by T-212; reads usable in T-209 board)
- `src/backend/repos/pg/pg-cue-repository.ts` — Postgres impl over Prisma client
- `src/backend/repos/__tests__/cue-repository.test.ts` — in-memory contract tests

### P-E. BaselineCueImporter (~0.5d)
- `src/backend/programming/cue/baseline-cue-importer.ts`:
  - reads `config/launch/launch_programming_schedule.v1.yaml` via existing `programming-schedule.ts` parser
  - converts dayparts + slot_templates → draft cues (best-effort; YAML semantic loss documented)
  - creates `PublicDiscussionCueSchedule (status='draft', source='baseline')`
  - idempotent: re-running with same YAML version produces identical schedule (compares `baseline_contract_version` + payload hash)
- **Shadow path**: existing `LaunchProgrammingOpsService` is NOT modified
- `__tests__/baseline-cue-importer.test.ts` — round-trip the existing YAML

### P-F. Read-only Cue Board (~1.5d)
- Backend: new `src/backend/routes/admin/admin-cue-board-routes.ts`
  - `GET /v1/admin/programming/cue-board?schedule_id=&community_id=&from=&to=` — returns timeline payload
  - reuses `requireHumanAuth + requireAdmin`
  - Zod request validator
- Frontend: `src/frontend/features/admin/pages/admin-panel/CueBoardTab.tsx`
  - timeline list view (cue card per row): trigger time, community, public hook, topic seed (admin-visible), scene family preview, role requirement summary, media count, status, source, risk, lane
  - **read-only** — no edit affordances yet (T-210 adds them)
  - Uses new hook `useAdminCueBoard()` in `src/frontend/api/hooks/admin.ts`
- Wire into `AdminPages.tsx` as `AdminCueBoardPage`

### P-G. Tests (~0.5d)
- Unit: cue-patch validator (accept + reject for each of 21 forbidden fields + version mismatch)
- Unit: cue domain Zod schemas (theme_intent, scene_constraints, role_requirements)
- Integration: BaselineCueImporter against actual YAML (asserts at least 1 schedule + N cues created)
- Smoke: in-memory repo CRUD lifecycle for schedule → cue → change → media

### P-H. Verification + close (~0.3d)
- `pnpm typecheck`
- `pnpm test src/backend/programming src/backend/repos/__tests__/cue-repository.test.ts src/backend/repos/__tests__/baseline-cue-importer.test.ts`
- `pnpm db:migrate:dev --name cue_programming_v1` (already applied)
- `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
- `git diff --stat` confirms no edits to RoomProgram/PostScheduler/allocator
- Update 00-overview status `in-progress → done`; record evidence in `04-verification.md`; sync registry

## Boundaries (anti-scope-creep)
- No edit UI (T-210)
- No CueWorker / no admission / no live execution (T-212)
- No load snapshot computation (T-213; table empty in this bundle)
- No auto editor / trigger detector (T-214)
- No projection facet for public surface (T-215)
- No `usage_strength = 'anchor' | 'selected_only_pool'` semantics (T-216 unlocks; enum values reserved here)
- No modification of `LaunchProgrammingOpsService` (shadow path)
- No `LaunchProgrammingSchedule` Prisma model (YAML stays YAML; only cue tables are added)

## Risks (carried)
- Prisma migration merge conflicts with `T-201` — mitigation: rebase before opening; coordinate naming
- YAML semantic loss in importer — best-effort; importer is opt-in; YAML stays usable for `LaunchProgrammingOpsService`
- `CuePatchV1` schema gap discovered later — `version: 1` enables evolution
- Forbidden-field SSOT drift — single constant mirrored from umbrella §3, imported by patch validator and (later) T-210 admin server validator

## Phase ordering (serial; nothing parallel within T-209)
P-A → P-B → P-C → P-D → P-E → P-F → P-G → P-H
