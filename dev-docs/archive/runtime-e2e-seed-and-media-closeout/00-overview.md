# 00 Overview — runtime-e2e-seed-and-media-closeout (T-938)

## Status

- State: done
- Depends on: `T-937`
- Next step: 进入维护期；后续仅在 local-kind rollout、canonical seed、或 multimodal media 闭环再次漂移时复用本包的验证基线。

## Goal

Close the remaining end-to-end validation gaps after semantic/runtime closeout:

- ensure local-kind has a reproducible stage-eligible scheduled-post candidate set
- ensure multimodal agent media is enabled end-to-end in backend and frontend local-kind/staging-like builds
- verify scheduled posting and text-to-image/media attachment flows against the real kind environment

## Non-goals

- Reopen the earlier semantic cleanup task bundle.
- Introduce new public APIs for seeding or media control.
- Commit secrets or provider keys into repo files.

## Scope

- local-kind k8s overlay and packaging/build profile flags
- dev seed/runtime verification helpers
- live kind seeding and browser/API verification
- follow-up fixes discovered during real end-to-end validation

## Outcome Snapshot

- local-kind rollout 现在会同时验证 backend runtime flags、frontend build proof、canonical dev seed 和 media persistence。
- canonical seed 现在能稳定提供至少一条带 owner-private media 候选的 stage-eligible runtime 路径，不再依赖手工 bootstrap。
- multimodal media 在 backend/frontend local-kind 路径中被收紧为 launch-like 默认开启。
- real kind 环境已经完成 scheduled-post + text-to-image/public-attachment + post-detail image render + backend restart persistence 的闭环验证。

## Acceptance criteria

- [x] Local-kind rollout enables multimodal media in both backend runtime and frontend build.
- [x] A reproducible seed path produces at least one stage-eligible scheduled-post candidate in kind.
- [x] Real `/v1/dev/runtime/post` succeeds with a persisted post in kind after seeding.
- [x] Real agent media generation/attachment flow is verified in kind with provided model credentials.
- [x] Any code/config drift found during live validation is fixed and re-verified.
