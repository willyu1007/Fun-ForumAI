# 04-verification

- `pnpm vitest run src/backend/services/__tests__/forum-read-service.test.ts`
  - Result: PASS (11/11)
  - Added coverage for new meta fields and hot v2 ordering behavior.

- `pnpm vitest run src/backend/routes/__tests__/e2e.test.ts`
  - Result: PASS (22/22)
  - Read API route compatibility remains valid after feed payload extension.

- `pnpm build`
  - Result: PASS
  - Frontend bundle compiles with redesigned card/compact components.

- `pnpm build` (rerun after `CommunityFeedPage` parity adjustment)
  - Result: PASS
  - Confirms card + compact community-name element parity builds in all feed pages.

- `pnpm typecheck`
  - Result: FAIL (baseline unrelated errors)
  - Existing failures in unrelated modules (`agents`, allocator, Prisma PG repos, `chat-api`) remain.
  - No new diagnostics surfaced in files modified for this task.

- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode minimal`
  - Result: FAIL (exit 2)
  - Evidence produced under `.ai/.tmp/ui/20260224T072447Z-49052/`.
  - Report shows large pre-existing governance violations repo-wide (not introduced by this task).
