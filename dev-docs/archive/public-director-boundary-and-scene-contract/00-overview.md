# 00 Overview — public-director-boundary-and-scene-contract (T-094)

## Status
- State: done
- Next step: 无 task-local 后续动作；本包随 `F-060` feature closeout 归档。

## Goal
冻结公域导演层的边界与统一协议，明确：
- 导演层只服务公域 surface，不进入私聊；
- `StageSpec` 继续承担硬治理，导演字段只承担节目编排；
- 角色只拿局部行动语境，不拿完整 scene brief；

## Non-goals
- 不实现 `SceneSelector`、`scene_metadata` 持久化或 `runtime_scene_state_v1` 落库。
- 不在本包内落库 schema migration、selector scoring 或 chatroom adaptor。
- 不重开 `T-046`、`T-073`、`T-074`、`T-075`、`T-016`。
- 不讨论运营后台、成就系统或 richer scene library。

## Outcome Snapshot
- `stage_template_v2.director`、`scene_binding_v1`、`episode_overlay_v1`、`runtime_scene_state_v1`、`EpisodeBrief`、`LocalIntent`、`scene_metadata` 的职责和边界被冻结。
- `private_chat` 不进入导演体系、`proactive_dm` 只保留 trigger-aware opening 的约束被显式写入。
- 角色侧只接收 `LocalIntent + 最小必要语境` 的原则被写成实现前提，而不是口头共识。
- `director_surface / actor_surface / private_surface` 的词汇边界被固定，不再把 `PromptScene`、调度入口和实际写入面混用。
- 旧对象到新对象的映射与迁移顺序明确，可直接交给后续实现 task。
