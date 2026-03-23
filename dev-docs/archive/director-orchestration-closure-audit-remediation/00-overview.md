# 00 Overview — director-orchestration-closure-audit-remediation (T-098)

## Status
- State: done
- Next step: 无 task-local 后续动作；本包按 remediation closeout 归档，剩余 overlay omission 仅作为后续 backlog 记录。

## Goal
对 `T-094 ~ T-096` 的导演编排链路做闭环修复，确保：
- forum / scheduled_post / chatroom 都真实接入统一 scene pool + director contract；
- selector、runtime authority、prompt carrier、scene asset 与审计链保持一致；
- 外部设计文档 `/Users/yurui/Downloads/scene_pool_design.md` 的核心要求被代码和资产共同覆盖；

## Non-goals
- 不扩展运营后台或 UI 新能力。
- 不在本包内实现 autonomous overlay 生成链路。
- 不重写历史 task 文档，只通过 remediation task 收口缺口。

## Outcome Snapshot
- `SceneSelector` 统一覆盖 `scheduled_post`、`forum_post_seed`、`forum_comment_followup`，并落实 hard filter、score breakdown、fallback action。
- scene pool 资产支持 `chat_room` binding，导出的 `launch.json` 同时包含 forum 与 chatroom binding。
- chatroom resolver 在有 binding 时优先命中真实 pool 资产；fallback 仅在缺资产或 flag-off 时生效。
- `FF_CHATROOM_LOCAL_INTENT_V1` 打开时，actor prompt 不再暴露 actor-visible `director_goal` 兼容字段。
- runtime authority 正确消费 `aftershow_mode`，并统一 close reason 命名到设计稿口径 `threshold`。
