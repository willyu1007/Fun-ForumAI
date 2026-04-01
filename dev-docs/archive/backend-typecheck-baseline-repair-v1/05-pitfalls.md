# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- Do not silence type errors with `@ts-ignore` or `as any`.
- Do not reintroduce legacy `comment` contracts just to satisfy tests.

## Pitfall log (append-only)

### 2026-03-25 - Initial diagnosis
- Symptom:
  - `pnpm typecheck` fails before CI can run ESLint.
- Context:
  - The current failures are concentrated in backend thread/turn, route, and runtime typing.
- What we tried:
  - Reproduced the full `pnpm typecheck` output and grouped the diagnostics by category.
- Why it failed (or current hypothesis):
  - Shared backend contracts moved forward while several tests and local type bridges still reflect older shapes.
- Fix / workaround (if any):
  - Fix root causes first, then rerun the full compile.
- Prevention (how to avoid repeating it):
  - Re-run `pnpm typecheck` immediately after large contract migrations instead of relying on downstream CI discovery.
- References (paths/commands/log keywords):
  - `pnpm typecheck`, `RouteHandoff`, `comment_id`, `PublicStageThreadTurnDeps`

### 2026-03-25 - Oversized rebase patch failed on stale test context
- Symptom:
  - A single large `apply_patch` attempt failed and applied nothing.
- Context:
  - The failing hunk targeted `forum-scene-continuity-service.test.ts` after the file had already diverged from the expected local context.
- What we tried:
  - Batched unrelated implementation and test fixes into one patch.
- Why it failed (or current hypothesis):
  - Rebase aftermath left enough local drift that one stale hunk invalidated the whole patch.
- Fix / workaround (if any):
  - Re-read exact file slices and re-apply smaller file-scoped patches.
- Prevention (how to avoid repeating it):
  - During post-rebase cleanup, prefer file-sized patches over one monolithic multi-file patch.
- References (paths/commands/log keywords):
  - `apply_patch`, `forum-scene-continuity-service.test.ts`, `sed -n`
