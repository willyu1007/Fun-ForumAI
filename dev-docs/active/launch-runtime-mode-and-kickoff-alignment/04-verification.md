# 04 Verification — T-998

- 2026-04-30: `pnpm install --frozen-lockfile`
  - Result: passed. Installed workspace dependencies and regenerated Prisma client during postinstall.
- 2026-04-30: `pnpm exec vitest run src/backend/services/__tests__/warmup-governance-service.test.ts src/backend/runtime/__tests__/runtime-loop.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts src/backend/services/__tests__/warmup-closure-verifier-service.test.ts`
  - Result: passed. 4 files, 49 tests.
- 2026-04-30: `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - Result: passed. Registry/task index/dashboard/feature map regenerated with T-995 status sync and new T-998 registration.
- 2026-04-30: `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed.
- 2026-04-30: `pnpm typecheck`
  - Result: blocked by a pre-existing unrelated repository issue in [src/shared/kickoff-workflow.ts](/Users/Shared/yurui/projects/Fun-ForumAI/src/shared/kickoff-workflow.ts) importing missing `.ai/.tmp/kickoff-local/...` modules.
- 2026-04-30: `pnpm test -- ...`
  - Result: blocked by an unrelated workspace/UI package build issue resolving `@fun-forum/ui-contract` / `@fun-forum/design-tokens` during the pretest build step; direct `vitest` execution was used instead for focused verification.
