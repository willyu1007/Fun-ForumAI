# 03 Implementation Notes — T-096

- 2026-03-13 初始化 planning-only task bundle，负责把 chatroom 节目系统纳入统一公域导演协议。
- 本包承接 `T-073 ~ T-075` 的既有聊天室资产，但不 reopen 这些历史 task。
- 本包依赖 `T-094` 的 contract freeze 与 `T-095` 的 selector/metadata 入口定义。
- 当前没有 runtime code 变更；仅冻结 shared runtime state、scene-aware casting、chatroom adaptor 的设计边界。
- 2026-03-13 覆盖性评审后，已把“指标/对照实验/节目感人工评审”并回本包，避免后续只验证机制完整、不验证观感目标。
- 2026-03-13 进入合同细化阶段：
  - 将 task 状态从 `planned` 推进到 `in-progress`；
  - 新增 `RuntimeSceneStateManager`，并把 shared runtime state 的唯一写权收口到该组件；
  - 把 chatroom 现有对象拆成 authority / adaptor / read model 三层，不再默认 `RoomEpisode` 或 `RoomLiveSnapshot` 就是 runtime authority；
  - 把 scene-aware casting 拆成“episode 级 roster shaping”与“turn 级 speaker scoring”两层；
  - 把 experiment bucket 固定在 `episode_id` 粒度，并为后续指标/人工 rubric 定义 carrier。
- 2026-03-13 决策冻结：
  - `runtime_scene_state_v1` 直接采用 dedicated state table，不再保留 authority sidecar 备选；
  - chatroom 从 `director_goal` 迁到 `LocalIntent` 采用 staged cutover；
  - 推荐以 `FF_DIRECTOR_RUNTIME_STATE_V1` -> `FF_CHATROOM_LOCAL_INTENT_V1` 的顺序灰度，而不是一次性硬切。
- 2026-03-13 实现 handoff 细化：
  - 补齐了 Prisma / repo / service 级建议文件与接口名：`RuntimeSceneState`、`runtime-scene-state-repository.ts`、`pg-runtime-scene-state-repository.ts`、`runtime-scene-state-manager.ts`；
  - 冻结了 shared runtime state 的写序：state authority 先更新，snapshot/read model 后刷新；
  - 列出了 chatroom cutover 的具体改造触点：`room-program-engine.ts`、`conversation-clock.ts`、`chatroom-runtime-context-builder.ts`、`room-program-projector.ts`、`chatroom-control-service.ts`；
  - 增加了 rollout matrix 和 env/config handoff，避免 feature flag 只写在架构文档里、不落到环境合同。

## Open follow-up actions
- 实现阶段需要把 dedicated state table 映射成 Prisma schema、repo 与 state-manager service。
- 实现阶段需要把 `director_goal_compat` 和 `LocalIntent` 的双写窗口压到最短，并补 fallback telemetry。
- 实现阶段需要把 rollout checklist 落到 `config.ts`、`docs/env.md`、`docs/context/env/contract.json`。
