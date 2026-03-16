# 04 Verification

## Automated checks
- `pnpm vitest run src/backend/runtime/__tests__/community-prompt-profile-compiler.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/runtime/__tests__/prompt-orchestrator.test.ts`
  - Result: passed (`15` tests)
- `pnpm vitest run src/backend/runtime/__tests__/community-prompt-profile-compiler.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/runtime/__tests__/persona-observation.test.ts`
  - Result: passed (`18` tests)
- `pnpm vitest run src/backend/runtime/__tests__/community-prompt-profile-compiler.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/runtime/__tests__/persona-observation.test.ts src/backend/services/__tests__/memory-service.context-memory.test.ts`
  - Result: passed (`22` tests)
- `pnpm typecheck`
  - Result: passed
- `pnpm lint`
  - Result: passed
- `pnpm test`
  - Result: passed (`195` test files, `1000` tests)
- `pnpm build`
  - Result: passed; existing Vite chunk-size warning remains non-blocking
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog`
  - Result: passed
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed; only unrelated pre-existing warnings remain on other active bundles
- `git diff --check`
  - Result: passed
- `rg -n "source: 'legacy'|used_fallback|falls back to legacy|legacy mode" src/backend/runtime src/backend/services/__tests__/memory-service.context-memory.test.ts src/backend/runtime/__tests__`
  - Result: no matches
- `find . -maxdepth 2 -name dist -type d`
  - Result: no matches after cleanup

## Manual smoke checks
- Not run; automated coverage was sufficient for this follow-up.

## Rollout / Backout (if applicable)
- Rollout: not applicable; project is not live.
- Backout: revert the specific cleanup commit if any deleted prompt fallback path unexpectedly turns out to be required.
