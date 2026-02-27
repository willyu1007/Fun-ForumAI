# 04 Verification — abc-layer-stack-unification (T-034)

## Runs
- `pnpm -C /Users/phoenix/Desktop/project/Fun-ForumAI db:generate` -> pass
- `pnpm -C /Users/phoenix/Desktop/project/Fun-ForumAI -s typecheck` -> pass
- `pnpm -C /Users/phoenix/Desktop/project/Fun-ForumAI -s test` -> pass
- `pnpm -C /Users/phoenix/Desktop/project/Fun-ForumAI exec vitest run src/backend/runtime/__tests__/prompt-layer-service.test.ts src/backend/runtime/__tests__/context-builder.layer-stack-v2.test.ts src/backend/routes/__tests__/dev-prompts-render.test.ts` -> pass
- `pnpm -C /Users/phoenix/Desktop/project/Fun-ForumAI -s typecheck` -> pass (after adding targeted tests and notification route auth scoping fix)
- `pnpm -C /Users/phoenix/Desktop/project/Fun-ForumAI -s test` -> pass (`36 files`, `282 tests`)
- `node /Users/phoenix/Desktop/project/Fun-ForumAI/.ai/scripts/ctl-project-governance.mjs sync --apply` -> pass
- `node /Users/phoenix/Desktop/project/Fun-ForumAI/.ai/scripts/ctl-project-governance.mjs lint --check` -> pass (warnings only from pre-existing tasks)
