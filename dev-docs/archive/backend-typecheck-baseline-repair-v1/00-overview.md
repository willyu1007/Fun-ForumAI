# 00 Overview — backend-typecheck-baseline-repair-v1 (T-920)

## Status
- State: done
- Next step: 已归档；后续若再次出现 backend type drift，单独开新任务包而不是复用本任务。

## Goal
Restore a clean repository-wide `pnpm typecheck` by fixing the current backend thread/route/type-contract drift without changing product behavior beyond what the types already require.

## Non-goals
- Refactor unrelated backend modules while fixing the errors.
- Change frontend behavior.
- Reintroduce legacy `comment` semantics where thread/turn contracts have already replaced them.

## Context
本任务修复了 backend thread/route/type-contract drift，并恢复了仓库级 `pnpm typecheck` 基线。后续首发灰测闭环也已在此基线上重新跑通 `lint/typecheck/test/build` 与 launch readiness gate。

## Acceptance criteria (high level)
- [x] `pnpm typecheck` completes with zero errors.
- [x] No `@ts-ignore` or `as any` suppressions are introduced.
- [x] Fixes preserve thread/turn and media-era contracts instead of restoring legacy `comment` behavior.
- [x] Any touched tests continue to reflect the current backend contracts.
