# 00 Overview — director-orchestration-closure-audit-remediation (T-098)

## Status
- State: done
- Next step: 无 task-local 后续动作；本包按 remediation closeout 归档，剩余 overlay omission 仅作为后续 backlog 记录。

## Goal
对 `T-094 ~ T-096` 的导演编排链路做闭环修复，确保：
- forum / scheduled_post / chatroom 都真实接入统一 scene pool + director contract；
- selector、runtime authority、prompt carrier、scene asset 与审计链保持一致；
- 外部设计文档 `/Users/yurui/Downloads/scene_pool_design.md` 的核心要求被代码和资产共同覆盖；
- 交付包含可执行验证，而不是只停留在单测绿灯。

## Non-goals
- 不扩展运营后台或 UI 新能力。
- 不在本包内实现 autonomous overlay 生成链路。
- 不重写历史 task 文档，只通过 remediation task 收口缺口。

## Context
- `T-094`、`T-095` 已标记完成，`T-096` 仍是 `in-progress`，但 repo 里仍存在跨包缺口和文档漂移。
- 当前 scene pool 导出只有 forum binding；chatroom 只能走 `legacy_fallback`，不算真正命中场景池。
- 当前 selector 只覆盖 `scheduled_post` 最小路径，未落实设计文档中承诺的 filter/score/audit contract。
- 当前 chatroom scene-enabled prompt 仍暴露 `director_goal` 兼容字段，违背“actor 只看 LocalIntent”的收敛目标。

## Acceptance criteria (high level)
- [x] `SceneSelector` 统一覆盖 `scheduled_post`、`forum_post_seed`、`forum_comment_followup`，并落实 hard filter、score breakdown、fallback action。
- [x] scene pool 资产支持 `chat_room` binding，导出的 `launch.json` 同时包含 forum 与 chatroom binding。
- [x] chatroom resolver 在有 binding 时优先命中真实 pool 资产；fallback 仅在缺资产或 flag-off 时生效。
- [x] `FF_CHATROOM_LOCAL_INTENT_V1` 打开时，actor prompt 不再暴露 actor-visible `director_goal` 兼容字段。
- [x] runtime authority 正确消费 `aftershow_mode`，并统一 close reason 命名到设计稿口径 `threshold`。
- [x] 增加可执行的 telemetry / audit 验证脚本，并完成 repo、本地 runtime、local-kind staging 与浏览器链路验证。

## Remaining omission
- `scene_pool_design.md` 提到的 editorial overlay 资产在 repo 中仍未落地；本包已明确记为未覆盖项，没有将其误记为“已完成”。
- rubric sheet 已由 assistant 完成 desk review；owner 若要更严格把关，可在后续 backlog 上另做抽样，不阻塞本包关闭。
