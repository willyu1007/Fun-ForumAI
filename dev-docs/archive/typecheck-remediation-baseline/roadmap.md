# Roadmap — typecheck-remediation-baseline (T-027)

## Objective
Restore a clean TypeScript compile baseline (`pnpm -s typecheck`) without introducing new product behavior.

## Scope
- Prisma client generation consistency
- Frontend compile-only fixes
- Backend type contract fixes
- Private channel dependency wiring fixes for compile correctness

## Out of scope
- New features
- Schema redesign
- App/mobile implementation

## Milestones
1. Reproduce and categorize diagnostics
2. Apply minimal compile-safe fixes by category
3. Re-run typecheck and test baseline
4. Record verification and handoff notes
