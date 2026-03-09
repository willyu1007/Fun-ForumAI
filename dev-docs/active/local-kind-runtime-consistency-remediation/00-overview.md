# 00 Overview — local-kind-runtime-consistency-remediation (T-071)

## Status
- State: done
- Next step: `T-071` 已清除 local-kind runtime blocker。后续回到 `T-070`，基于 `.ai/.tmp/t070/t070-2026-03-09T08-07-58-214Z` 进入 blind review / finalize。

## Goal
修复阻断 `T-070` 的 local-kind runtime drift，确保本地 staging 实际运行的 backend 与仓库源码、persona runtime flags、public/private observation 写面保持一致。

## Non-goals
- 不重开 `T-048`；仅在本包中记录其为历史 antecedent。
- 不接手 blind review / finalize；这些仍留在 `T-070`。
- 不重定义 `T-066` 的 observation schema 或 `T-070` 的 rollout gate。

## Acceptance criteria (high level)
- [x] local-kind staging 不再静默复用 stale `fun-forum-api:dev` 镜像。
- [x] `GET /v1/admin/runtime/features` 可暴露 runtime/build fingerprint 与 persona runtime 关键 flags。
- [x] local-kind `POST /v1/dev/runtime/post` / `POST /v1/dev/seed` 不再因环境漂移持续触发 `posts_community_id_fkey`。
- [x] `T-070` 重跑后不再出现 warmup 全 `write-failed` 或 `shadow-runs-missing-persona-observation` blocker。
