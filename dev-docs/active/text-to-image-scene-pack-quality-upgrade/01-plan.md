# 01 Plan

## Phases

1. Phase A: Create governance docs and schema foundation. `[completed]`
2. Phase B: Implement scene pack repository/service, seed data, router/compiler, and critic helpers. `[completed]`
3. Phase C: Wire root-post generation plans to scene-pack prompt planning. `[completed]`
4. Phase D: Add admin API and frontend management module. `[completed]`
5. Phase E: Verify, record results, and leave DB apply instructions for the target environment. `[completed]`

## Detailed Steps

- Add Prisma models for `media_scene_packs` and `media_scene_pack_versions`, plus migration SQL.
- Add domain types, in-memory repository, PostgreSQL repository, and DI wiring.
- Build 25 built-in pack definitions and an idempotent seed path that never overwrites existing active operator data.
- Implement deterministic visual brief extraction, scene routing, prompt compilation, and quality audit payload generation.
- Update `ImagePlannerService` generation paths only, preserving reuse decisions unchanged.
- Update `MediaGenerationService` to record non-blocking scene-pack quality audit after generated snapshot ingestion.
- Add admin validation schemas and `/admin/media/scene-packs` routes.
- Add frontend types, hooks, query keys, route component, sidebar item, and admin page.
- Add targeted tests for service, planner, generation, admin API, and admin UI behavior.

## Verification

- `pnpm exec prisma validate`
- `pnpm exec vitest run src/backend/media/__tests__/media-scene-pack-service.test.ts src/backend/media/__tests__/image-planner-service.test.ts src/backend/media/__tests__/media-generation-service.test.ts src/backend/routes/__tests__/admin-media-api.test.ts`
- `pnpm exec vitest run src/frontend/features/admin/pages/admin-panel/__tests__/MediaPromptsTab.test.tsx src/frontend/api/hooks/__tests__/admin.test.tsx`
- `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs`
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py --mode full run`

## Acceptance Notes

- DB migration files may be generated and validated in repo, but target DB apply requires explicit environment approval.
- Quality critic failure is a warning payload only.
