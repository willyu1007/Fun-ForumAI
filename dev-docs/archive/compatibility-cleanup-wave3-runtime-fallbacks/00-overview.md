# 00 Overview — compatibility-cleanup-wave3-runtime-fallbacks (T-110)

## Status
- State: done
- Next step: none; Wave 3 runtime fallback cleanup is implemented and verified.

## Goal
- Delete rollout-era runtime fallback paths that still route prompt composition and public scene selection back to legacy behavior.
- Keep only explicit service-initialization/null-dependency guards; do not preserve legacy runtime behavior once the canonical service is wired.
- Verify that prompt orchestration, private boundary handling, and public scene selection all operate without feature-flag fallback branches.

## Non-goals
- Do not change DB schema or migrations.
- Do not revisit Wave 1/2 canonical write cleanup except where Wave 3 tests need fixture updates.
- Do not redesign unrelated legacy read compatibility in identity/context-memory.

## Acceptance criteria
- Runtime prompt composition no longer silently falls back from `PromptOrchestrator` / `PromptLayerService` to legacy layer assembly when the canonical services are present.
- Private chat / proactive DM no longer fall back to legacy prompt construction when orchestrator composition fails.
- Scheduled post generation no longer falls back to legacy scene-less posting when the public scene selector returns fallback.
- Public scene catalog/continuity wiring no longer depends on rollout flags for v1 availability.
- Dead rollout-era env/config flags for the removed runtime paths are deleted from backend config, env contract artifacts, and local-kind staging helpers.
- Full repo gates pass after removing or rewriting affected fallback-oriented tests.

## Outcome
- `PromptOrchestrator` is now the canonical prompt-governance layer for wired runtime paths; prompt failure no longer silently drops to rollout-era legacy assembly.
- Private chat and proactive DM now fail fast if orchestration is unavailable or throws, instead of switching to legacy prompt contracts.
- Scheduled post creation now requires a selected public scene; selector skips abort the post attempt instead of falling back to legacy scene-less posting.
- Public scene launch catalog and continuity wiring now resolve without `FF_PUBLIC_DIRECTOR_CONTRACT_V1`.
- The rollout-only flags removed by Wave 3 are no longer exposed through `src/backend/lib/config.ts`, `env/contract.yaml`, generated env docs, or local-kind staging scripts/overlays.
