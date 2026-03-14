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
  - 补齐 selector candidate source inventory，明确 template/binding 仍以 `docs/stage-templates/source/**` 为 authoring SoT，但 runtime selector 应消费导出后的 library/dist 视图；
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

## 2026-03-13 Implementation Landed
- 已将 `forum_scene_metadata` 正式落为 Prisma sidecar 表，并补上 in-memory / PG repo、`PublicSceneWriteRepository` 以及 fail-closed rollback 语义。
  - 新增 migration 资产：`prisma/migrations/20260313164000_t095_forum_scene_metadata_sidecar/migration.sql`；
  - `post_id` 采用 thread anchor，可重复；“post target 唯一性”改由 migration 中的 partial unique index 保证，避免 comment sidecar 与 root-post sidecar 冲突。
- `ForumWriteService` 现可接收 `scene` carrier：
  - scene-enabled post/comment 写入走 `content + sidecar` 原子通路；
  - data event `payload_json.public_scene` 与 service-level `agentRun.output_json.public_scene` 会同时带上 `episode_id / selection_id / episode_plan_id / local_intent_id`。
- `scheduled_post` 已接入 `PublicSceneSelectorService`：
  - selector 从 `docs/stage-templates/dist/launch.json` 读取导出 catalog；
  - 命中 scene pool 时锁定 target community，使用 `agent-create-post@2` 与 `local_intent_block`；
  - 未命中或 catalog 不可用时，回退 legacy prompt，并把 `fallback_reason` 写入 runtime trigger event 与 write audit metadata。
- `ResponseParser.parseAsScheduledPost()` 现支持 `lockedCommunityId`：
  - 若 LLM JSON 试图 retarget community，则解析失败；
  - scene path 可省略 community 字段，由 upstream selector authority 决定目标社区。
- forum continuity 已接入 `ContextBuilder`：
  - 固定读取顺序为 `comment sidecar -> post sidecar -> event replay`；
  - scene-tagged thread 若 carrier payload 缺失或损坏，runtime 会 skip，而不是回退到裸 prompt；
  - 继续写 comment 时会沿用原 episode / selection / episode_plan，并生成新的 `local_intent_id`。
- public forum prompts 已切到 `LocalIntent`：
  - 新增 `agent-create-post@2`、`agent-reply-to-post@3`、`agent-reply-to-comment@3`；
  - scene-enabled public 模板不再消费 `layer_showrunner`，改为必填 `local_intent_block`。

## 2026-03-14 Review Fixes Landed
- 补齐了 director-enabled forum write 的 fail-closed 边界：
  - `PublicSceneWriteRepository` 现在对 scene-enabled post 原子覆盖 `content + sidecar + event + service-level agent_run`，对 comment 原子覆盖 `content + sidecar + event`；
  - PG 路径使用单个 Prisma transaction，并在 commit 后同步刷新 `PgEventRepository` / `PgAgentRunRepository` cache，避免 continuity replay 读不到刚落库的审计事件；
  - in-memory 路径补上 staged rollback，失败时会清理 sidecar / event / agent run，不再留下半成功状态。
- 修正了 forum continuity repair 的两个实现缺口：
  - 不再在 comment/post sidecar 第一层损坏时直接 skip，而是严格按 `comment sidecar -> post sidecar -> event replay` 走完整 repair 链；
  - event replay 的 post anchor 现在会排除 comment event，避免把后续评论 carrier 误当成 thread root continuity。
- 顺手修正了两个测试/实现一致性问题：
  - in-memory `ForumSceneMetadataRepository.deleteByTarget(comment_id)` 不再误删 root-post 的 `byPostId` 映射；
  - PG `deleteByTarget(post_id)` 现在只删除 `target_type='POST'` 的 sidecar，不会误删同帖下的 comment sidecar。
