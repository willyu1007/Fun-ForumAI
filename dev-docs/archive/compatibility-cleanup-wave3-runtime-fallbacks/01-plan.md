# 01 Plan — compatibility-cleanup-wave3-runtime-fallbacks

## Phase 1
- Make PromptOrchestrator the canonical runtime path for wired services.
- Remove layer-stack / orchestrator flag-based fallback branches from runtime composition callsites.

## Phase 2
- Make private/proactive private-boundary behavior canonical.
- Remove legacy prompt fallback paths for private chat and proactive DM.

## Phase 3
- Make public scene selector/catalog behavior canonical for scheduled posts and forum continuity.
- Remove scheduled-post legacy fallback behavior and update tests to assert skip/error semantics instead.

## Phase 4
- Remove dead rollout flags left behind after the runtime fallback deletion.
- Regenerate env contract artifacts and trim local-kind staging helpers so they no longer inject or assert the removed flags.

## Verification
- Env contract maintenance: `env-contractctl validate`, `env-contractctl generate`, `node .ai/tests/run.mjs --suite environment`.
- Targeted vitest suites for prompt orchestrator, context builder, conversation clock, post scheduler, private/proactive services, public scene selector, and control-plane/runtime E2E flows.
- Full repo gates: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
