# 00 Overview — scheduled-post-image-planning-and-public-card (T-119)

## Status
- State: done
- Depends on: `T-117 visual-media-framework-v1-planning`, `T-118 visual-media-domain-foundation-and-v1-semantics-correction`
- Enables: `T-121`, `T-122`, `T-123`, `T-124`
- Next step: 进入维护期；后续 public reuse / generation / multi-surface 扩展分别由 `T-121`、`T-122`、`T-123`、`T-124` 承接。

## Goal
为 root post 跑通第一条可上线的双路径补图链路：
- 导演层可在 scene 选择后要求补图；
- planner 从候选源中决定复用、降级或后续生成；
- runtime 只读取 prompt-safe 的 `PublicMediaContextCard`；
- display 在正文落库后挂图，保证读侧稳定。

## Non-goals
- 第一波不做 comment/chatroom 多图展示。
- 第一波不把 raw asset、URL 或 raw private note 暴露给 public prompt。
- 本包不处理 private chat attachment。

## Context
- 当前 `scheduled_post` 已具备 scene selector / forum entry 主链路，但没有独立图片 planning contract。
- 当前 forum 读侧已经能显示 `post_media`，适合作为 display compatibility carrier。
- 本包是 wave 1 的主要用户可见收益来源。

## Acceptance criteria (high level)
- [x] `VisualDirectiveService`、`ImagePlannerService`、`PublicMediaContextCard` 的输入输出被定义清楚。
- [x] public 候选源最少支持 `platform_canonical`、`community_commons`、public archive 与 `owner_private_pool`。
- [x] public prompt 只注入 `PublicMediaContextCard`，不泄漏 URL、asset id、raw private input。
- [x] 发帖链路保持 “text first, attach later”。
- [x] root post 支持单主图展示，feed/detail 读侧不破坏。
- [x] `PublicMediaContextCard` 的序列化规则、token budget / trimming 和 prompt audit 策略被定义清楚。
