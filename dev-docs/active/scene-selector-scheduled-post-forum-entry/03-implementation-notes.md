# 03 Implementation Notes — T-095

- 2026-03-13 初始化 planning-only task bundle，承接统一导演协议的第一个实现入口设计。
- 本包显式依赖 `T-094` 的 contract freeze，不单独重谈 private/public boundary。
- 本包不复用 `T-016 future-platform-evolution`；`T-016` 仅保留为长期 backlog 仓库。
- 当前未改动 `post-scheduler`、forum runtime 或 parser/writer 实现；仅冻结接入设计。
- 2026-03-13 进入合同细化阶段：
  - 将 task 状态从 `planned` 推进到 `in-progress`；
  - 在 `02-architecture.md` 中补齐 `SceneSelectorInput / SceneSelectionResult / SceneSelectionAudit`；
  - 明确 `scheduled_post / forum_post_seed / forum_comment_followup` 三类 entry kind；
  - 冻结 `EpisodeBrief -> LocalIntent` 的逐入口降维规则；
  - 明确 parser 不得改写 scheduled_post target，forum comment 默认 follow existing episode。
- 2026-03-13 冻结前 review：
  - 补齐 selector candidate source inventory，明确 template/binding 仍以 `docs/stage-templates/v1/**` 为 authoring SoT，但 runtime selector 应消费导出后的 library/dist 视图；
  - 明确 overlay candidate 需区分 editorial / automated / autonomous 三类来源，且 `autonomous` 只在 `autonomous_anchored` 模式下入池；
  - 明确 continuity seed 的优先级为 `content scene_metadata > thread anchor ids > event payload / agent run replay`；
  - 明确 trigger event `payload_json`、`agent_run.output_json`、content-level `scene_metadata` 三层 carrier 的职责边界；
  - 显式禁止把 `moderation_metadata_json` 升格为 `scene_metadata` 的长期 SoT。
- 2026-03-13 forum content carrier draft：
  - 将 `scene_metadata` 的推荐落点冻结为 forum-scoped sidecar `forum_scene_metadata`，而不是 post/comment 双 JSON 列或 moderation metadata；
  - 为 carrier 定义了最小 repo contract：`upsert`、`findByTarget`、`listByPost`、`findLatestByEpisode`；
  - 为 continuity 查询定义了固定读取顺序：comment carrier -> post carrier -> event/run replay fallback；
  - 明确 `ForumWriteService` 在实现 phase 需接收 `scene_metadata_sidecar` 输入，并在 data event 发出前完成 sidecar upsert。

## Open follow-up actions
- 实现阶段需要把 `forum_scene_metadata` 映射成具体 Prisma schema、repo 和 migration 方案。
- 实现阶段需要决定 sidecar 写入失败时是 fail closed 还是 repair queue，并补对应 observability。
