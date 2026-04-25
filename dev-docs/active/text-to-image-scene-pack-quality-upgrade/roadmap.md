# Roadmap — text-to-image-scene-pack-quality-upgrade

## Summary

Upgrade root-post text-to-image quality by adding DB-versioned scene packs, a prompt planning layer before media generation, admin management/preview surfaces, and non-blocking quality audit. The first rollout keeps the existing media generation gateway and Ark/DashScope fallback path intact.

## Milestones

1. Task governance and DB shape: create this bundle, add Prisma models/migration for scene packs and versions, and keep DB context refresh ready for post-apply.
2. Scene pack domain: seed 25 built-in packs, add repository/service APIs, deterministic visual brief extraction, scene routing, prompt compilation, and non-blocking critic helpers.
3. Runtime integration: wire scene-pack planning into root-post scratch/reference generation only, persist scene-pack prompt metadata on image plans/jobs, and record quality audit events after generated snapshots.
4. Admin management: expose `/v1/admin/media/scene-packs` APIs and add `/admin/media-prompts` UI for listing, draft editing, activation, release, routing preview, and compile preview.
5. Verification and rollout: run targeted backend/frontend tests, Prisma validation, LLM registry validation, UI gate, and document any environment-only DB apply steps.

## Project Structure Change Preview

- `prisma/schema.prisma` and `prisma/migrations/*scene_pack*`
- `src/backend/media/*scene-pack*`, repositories, admin routes, validation schemas, and tests
- `src/frontend/features/admin/pages/admin-panel/*MediaPrompt*`, admin hooks/types/routes/sidebar
- `dev-docs/active/text-to-image-scene-pack-quality-upgrade/*`

## Risks

- The prompt compiler must remain compatible with existing `CompiledMediaPrompt` gateway consumers.
- Runtime generation should not regress reuse paths; only generation paths should receive scene-pack prompts.
- Scene pack DB seeding must be idempotent and avoid overwriting operator-edited versions.
- Admin UI must follow existing data-ui/Tailwind B1 constraints.

## Rollback

- Disable runtime use of scene-pack planning by reverting ImagePlanner wiring while keeping DB/API data intact.
- Re-activate an earlier scene pack version through the admin API to roll back prompt content.
- If quality audit is noisy, keep generation active and suppress only the observability event emission.
