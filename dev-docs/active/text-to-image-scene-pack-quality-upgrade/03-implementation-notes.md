# 03 Implementation Notes

## 2026-04-24

- Created task bundle for the scene-pack quality upgrade before code/config changes, per `dev-docs/AGENTS.md`.
- Confirmed existing runtime chain already supports structured generation spec and fallback media generation; this task adds planning/management layers rather than replacing the gateway.
- Added `MediaScenePackRecord` / `MediaScenePackVersionRecord` Prisma models and repository implementations for in-memory and PostgreSQL paths.
- Added 25 built-in scene pack seeds with active v1 versions, deterministic route scoring, scene-pack prompt compilation, draft lifecycle operations, and compile/route preview support.
- Inserted prompt planning at the generation compile point in `ImagePlannerService`; `reuse_public_original` remains unchanged and legacy compiled prompt fallback remains available.
- Added advisory scene-pack quality audit after successful generation output ingestion; audit records observability and does not cancel, retry, or hide generated assets.
- Added `/v1/admin/media/scene-packs/*` APIs and `/admin/media-prompts` console UI for list/detail/draft/edit/activate/release/preview workflows.

## 2026-04-25 Deep E2E Follow-up

- Fixed media generation provider routing so `dashscope-qwen-image` can be the primary text-to-image gateway from `MEDIA_GENERATION_PROVIDER/MEDIA_GENERATION_MODEL/MEDIA_GENERATION_API_KEY`, while fallback routing remains available when only a fallback provider is configured.
- Fixed `scripts/k8s-local-staging.mjs --image-tag` drift: the script now sets the backend deployment image after applying the local-kind overlay, so the pod actually runs the freshly built image instead of the overlay default.
- Added `id` / `name` attributes to the new admin media prompt form controls after Chrome DevTools reported missing form field identifiers.
- Ran a real Qwen Image 2.0 generation against the kind Postgres database: scene pack planning selected `desktop_workflow_photo@1`, created a scratch generation job, generated an asset, backfilled the image plan, and recorded `scene_pack_quality_audited`.

## 2026-04-25 Cleanup Follow-up

- Localized the new admin module shell to contextual Chinese: sidebar/page name is now `文生图场景与提示词`, and the scene editor uses Chinese labels for lifecycle actions, visual contract fields, safety boundaries, version state, and preview actions.
- Renamed the 25 built-in seed pack display names to Chinese while keeping stable `scene_id`, `media_family`, routing keywords, prompt bodies, API paths, and persisted field names unchanged.
- Closed a UI contract gap by exposing `real_world_anchor_required` as the `必须有现实锚点` checkbox; this field was already present in form state and API payload but had no editor control.
- Removed one-off E2E artifacts from `.ai/.tmp` (`scene-pack-real-e2e.mts`, `media-prompts-admin-e2e.png`) so future agents do not mistake them for maintained tests.

## Open Issues

- `pnpm typecheck` still fails on existing runtime/test type issues outside this task; the latest run reports no scene-pack/admin-media/gateway files after the test intent fix.
