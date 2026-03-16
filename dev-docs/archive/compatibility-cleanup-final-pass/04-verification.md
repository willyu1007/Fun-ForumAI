# 04 Verification — compatibility-cleanup-final-pass

## Automated checks
- `pnpm db:generate`
- `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out dev-docs/archive/compatibility-cleanup-final-pass/artifacts/env/03-validation-log.md`
- `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py generate --root . --out dev-docs/archive/compatibility-cleanup-final-pass/artifacts/env/04-context-refresh.md`
- `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
  - Result: `195` test files / `1000` tests passed
- `pnpm build`
  - Result: pass; retains the pre-existing Vite large-chunk warning
- `node .ai/tests/run.mjs --suite environment`
- `git diff --check`
- Static guards:
  - `rg -n "legacy_default|legacy_persona_style|director_goal_compat|legacy_fallback|min_comments|min_human_vote_score|compatibility_digest|compatibilityDigest|chatroomLocalIntentV1|controlPlaneConfigV1|chronicleSignalPolicyV2|incubationTrustHardEnforce" src scripts env docs ops .ai --glob '!dev-docs/archive/**'`
  - `rg -n "legacy_|compatibility_" src scripts env docs ops .ai --glob '!dev-docs/archive/**'`
  - `rg -n "legacy[A-Z]|compatibility[A-Z]" src scripts env docs ops .ai --glob '!dev-docs/archive/**'`

## Manual smoke checks
- Verified prompt-template loading after renaming `compatibility_digest` to `memory_digest` by re-running prompt/render and full test coverage that imports the prompt registry.
- Verified control-plane config rejects removed legacy proposal routes and top-level stage-spec fields while canonical `stage_spec_v1` flows still validate/apply.
- Verified chatroom cue API now rejects rooms that are not canonically prepared for director control instead of falling back to legacy scene synthesis.

## Rollout / Backout (if applicable)
- Rollout: single-shot repo cleanup; no staged rollout window is required.
- Backout: revert the task branch/changeset or reset local DB state after reverting schema changes.
