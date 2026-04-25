# 00 Overview — text-to-image-scene-pack-quality-upgrade

## Status

- State: implemented, pending target DB migration apply
- Depends on: repo Prisma migration review/apply, root-post media generation configuration, admin auth.
- Current status: DB-backed scene packs, prompt planning, admin API/UI, and non-blocking quality audit are implemented.
- Next step: review/apply `prisma/migrations/20260424140000_t994_scene_pack_prompt_planning/migration.sql` against the intended DB environment.

## Goal

Improve root-post text-to-image output by routing visual generation through concrete real-world scene packs, while preserving the existing media generation foundation and provider fallback path.

## Non-goals

- Do not rewrite `MediaGenerationGateway` providers or change Ark/DashScope credentials.
- Do not enable thread/chat-room image generation in this first rollout.
- Do not make the Visual Quality Critic block, retry, or remove generated images.
- Do not move hidden LLM prompt template governance into the admin UI.

## Acceptance Criteria

- [x] 25 built-in scene packs exist as active DB-seeded versioned records.
- [x] Root-post generation paths compile prompts from visual brief + selected scene pack + platform safety boundaries.
- [x] Existing reuse paths and legacy compiled prompt execution remain compatible.
- [x] Admin APIs and UI support list/detail/draft/edit/activate/release/preview workflows.
- [x] Non-blocking quality audit records observability events without changing successful generation display.
- [x] Targeted backend/frontend tests and Prisma validation pass or documented unrelated failures remain isolated.
