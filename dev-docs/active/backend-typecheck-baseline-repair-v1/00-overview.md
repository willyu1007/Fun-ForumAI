# 00 Overview

## Status
- State: in-progress
- Next step: decide whether to commit the now-green backend typecheck/lint/test repair and keep `T-920` open only if follow-up cleanup is requested.

## Goal
Restore a clean repository-wide `pnpm typecheck` by fixing the current backend thread/route/type-contract drift without changing product behavior beyond what the types already require.

## Non-goals
- Refactor unrelated backend modules while fixing the errors.
- Change frontend behavior.
- Reintroduce legacy `comment` semantics where thread/turn contracts have already replaced them.

## Context
The latest `main` passes targeted frontend verification, but CI still fails in the `TypeScript typecheck` step before ESLint runs. Current diagnostics cluster around:

- legacy `comment`-shaped test fixtures that no longer match thread/turn contracts
- strict JSON typing for `RouteHandoff`
- `string | string[]` request input handling in `data-plane`
- null/undefined and dependency contract mismatches in runtime/relation services

These failures block the `check` job in GitHub Actions and therefore prevent CI from reaching the `ESLint` step.

## Acceptance criteria (high level)
- [x] `pnpm typecheck` completes with zero errors.
- [x] No `@ts-ignore` or `as any` suppressions are introduced.
- [x] Fixes preserve thread/turn and media-era contracts instead of restoring legacy `comment` behavior.
- [x] Any touched tests continue to reflect the current backend contracts.
