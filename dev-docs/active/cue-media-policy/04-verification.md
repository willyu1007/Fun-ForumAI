# 04 Verification - T-216 cue-media-policy

## Evidence Summary

Governance cleanup date: 2026-04-27.

This bundle is closed as of 2026-04-27. M0, M1, the M2 API surface, M3 admin UI, audit dashboard, and cue-runtime pre-write media enforcement have shipped.

## Recorded Runs

From `03-implementation-notes.md`:

```
356/356 cue + load + media tests green
tsc + lint clean
```

Recorded coverage includes:

- four-value `usage_strength` validator unlock
- `MediaPlanResolution` repository/table plumbing
- `CueMediaPlanner.record()` audit rows
- `imagePlannerService.planScheduledPost` / `planWithDirective` `anchor_asset_id?` parameter
- `imagePlannerService.planScheduledPost` / `planWithDirective` `candidate_asset_ids?` selected-only filter
- cue worker pre-write `CueMediaPlanner.planForWrite()` before `dataPlaneWriter.write()`
- admin four-way strength selector
- admin media-plan resolution audit route and UI

Latest closure run:

```
pnpm test src/backend/media/__tests__/cue-media-planner.test.ts src/backend/media/__tests__/surface-media-planning-service.test.ts src/backend/media/__tests__/image-planner-service.test.ts src/backend/runtime/__tests__/public-discussion-cue-worker.e2e.test.ts
```

Result: 4 files passed, 36 tests passed.

Filtered typecheck:

```
pnpm exec tsc -p tsconfig.node.json --noEmit --pretty false 2>&1 | rg "cue-media-planner|public-discussion-cue-worker|surface-media-planning-service|image-planner-service|container/index|lib/config"
```

Result: no diagnostics for touched T-216 runtime/media files.

Deep validation run (2026-04-27):

```
pnpm vitest run \
  src/backend/routes/__tests__/e2e-cue-editor-lifecycle.test.ts \
  src/backend/routes/__tests__/admin-cue-routes.test.ts \
  src/backend/services/__tests__/cue-editor-service.test.ts \
  src/backend/programming/cue/__tests__/cue-patch.test.ts \
  src/backend/programming/cue/__tests__/locked-fields-validator.test.ts \
  src/backend/programming/cue/__tests__/cue-admission-controller.test.ts \
  src/backend/programming/cue/__tests__/director-cue-brief.test.ts \
  src/backend/runtime/__tests__/public-discussion-cue-worker.test.ts \
  src/backend/runtime/__tests__/public-discussion-cue-worker.e2e.test.ts \
  src/backend/runtime/__tests__/post-scheduler-cue-isolation.test.ts \
  src/backend/services/__tests__/cue-public-projection-service.test.ts \
  src/backend/launch/__tests__/programming-projection-cue-facet.test.ts \
  src/backend/launch/__tests__/programming-contracts.test.ts \
  src/backend/services/__tests__/cue-board-read-service.test.ts \
  src/backend/services/__tests__/auto-patch-apply-service.test.ts \
  src/backend/routes/__tests__/admin-auto-patch-routes.test.ts \
  src/backend/programming/auto-editor/__tests__/trigger-detector.test.ts \
  src/backend/programming/auto-editor/__tests__/auto-cue-editor.test.ts \
  src/backend/programming/auto-editor/__tests__/auto-cue-editor-validator.test.ts \
  src/backend/programming/auto-editor/__tests__/llm-gateway-auto-cue-editor-adapter.test.ts \
  src/backend/programming/auto-editor/__tests__/auto-cue-editor-scheduler.test.ts \
  src/backend/programming/auto-editor/__tests__/risk-classifier.test.ts \
  src/backend/programming/load/__tests__/admission-load-service.test.ts \
  src/backend/programming/load/__tests__/auto-editor-allowed-actions.test.ts \
  src/backend/media/__tests__/cue-media-planner.test.ts \
  src/backend/media/__tests__/surface-media-planning-service.test.ts \
  src/backend/media/__tests__/image-planner-service.test.ts
```

Result: 27 files passed, 396 tests passed.

Additional validation:

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm exec prisma validate` passed.
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` passed.
- `git diff --check` passed.
- `node ops/packaging/scripts/build.mjs --dry-run --build-profile launch` reported ready to build.
- `pnpm deploy:dry-run` reported a ready staging handoff plan with `staging-same-host-worker` profile and `web worker` rollout steps.
- `kubectl kustomize ops/deploy/k8s/overlays/local-kind` rendered 270 lines successfully.
- `pnpm exec playwright test tests/web/playwright/forum-orchestration.e2e.spec.ts --project=desktop-light --config=playwright.config.mjs` passed 2 browser tests.

## Acceptance Audit

Complete:

- M0 validator unlock for all four strengths
- M1 audit rows for media pool decisions
- M2 end-to-end anchor cue post uses selected asset or derivative
- M2 derivative path uses the `imagePlannerService` reference path that writes `based_on_projection_ids`
- M3 `selected_only_pool` runtime enforcement before post write
- M3 admin strength selector
- MediaPlanResolution audit dashboard

Open: none for T-216.

## Closure Notes

`PublicDiscussionCueWorker` now calls `CueMediaPlanner.planForWrite()` before
`dataPlaneWriter.write()`. The active path is:

`PublicDiscussionCueWorker -> CueMediaPlanner -> SurfaceMediaPlanningService -> imagePlannerService -> DataPlaneWriter`.

`MediaPlanResolution` rows are still persisted after successful write, but they
now reflect the pre-write media decision rather than an audit-only inference.
The runtime policy is default-on after closure; set
`CUE_MEDIA_POLICY_ANCHOR_MODE=false` for rollback.
