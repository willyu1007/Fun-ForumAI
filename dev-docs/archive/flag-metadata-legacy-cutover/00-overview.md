# 00 Overview — flag-metadata-legacy-cutover (T-952)

## Status

- State: done
- Depends on: live surface inventory, typed replacement contract design, Prisma migration preview, repo-wide verification
- Current status: repo-side cutover work is complete. frontend/mobile/backend flag hubs are cut from live runtime, legacy health routing is removed, all targeted generic metadata / legacy persistence surfaces are replaced by typed contracts, `pnpm cutover:preflight` is clean with `0` findings and `0` remaining Prisma metadata fields / legacy models, isolated DB apply rehearsal passes on a fresh disposable PostgreSQL 14 target, `pnpm verify:launch:ci` is green at `18/18`, the canonical packaging build succeeds for `llm-forum:ci-validate`, and the maintenance-window preflight package is complete.
- Next step: 无；staging 环境发布检验已拆分到 follow-up bundle `dev-docs/active/staging-release-verification-followup/` 承接。

## Goal

Make launch-state behavior the only live runtime path by removing all live flag hubs, generic metadata buckets, and legacy compatibility surfaces from repo-tracked runtime code, schema, contracts, and tests.

## Non-goals

- Do not rewrite historical migration SQL or archived dev-docs bundles.
- Do not preserve environment-level feature branching after the cutover.
- Do not apply DB writes to a target environment until migration preview, maintenance-window procedure, and rollback evidence are ready.

## Context

The original live inventory contained:

- frontend `VITE_FF_*`, mobile `EXPO_PUBLIC_FF_*`, and backend `FF_*`/`config.features.*` gating
- generic `meta`, `metadata`, `moderation_metadata`, `*_meta`, `metaJson`, `metadataJson`, and `moderationMetadataJson` surfaces across APIs, domain types, repositories, and Prisma models
- live legacy compatibility surfaces including legacy health routing, mobile compat theme exports, legacy media/status labels, and live legacy Prisma models

This task is a decision-complete cutover, not a partial cleanup. The end state must leave a single canonical launch path with typed contracts and no live compatibility shims.

## Acceptance Criteria

- [x] No live runtime/frontend/mobile/backend code contains `VITE_FF_`, `EXPO_PUBLIC_FF_`, `FF_`, or `config.features`.
- [x] No live schema contains `metaJson`, `metadataJson`, `moderationMetadataJson`, `LegacyAgentMediaAsset`, or `LegacyGrowthEventArchive`.
- [x] No live runtime imports `@fun-forum/ui-mobile/compat` or registers `createLegacyApiHealthRouter`.
- [x] Generic `meta` / `metadata` / `*_meta` cutover surfaces targeted by this task are replaced by explicit typed fields or typed child structures.
- [x] Inventory/preflight tooling blocks migration if any existing metadata key lacks a typed target.
- [x] Prisma migration preview exists and DB context contract refresh path is documented.
- [x] Repo-wide verification passes, or remaining blockers are explicitly documented in `04-verification.md` with owner and reason.

## Closure summary（2026-04-11）

- **已交付**: live flag / metadata / legacy runtime cutover；Prisma migration preview；DB context refresh；UI governance / Playwright / mobile smoke / route regression 收口；isolated DB apply rehearsal；`pnpm verify:launch:ci` green；canonical packaging build green；maintenance-window preflight package。
- **移交**: staging 环境的真实发布检验、DB apply、deploy smoke、rollback evidence 迁移到 follow-up bundle `staging-release-verification-followup`，不再扩大本包范围。
