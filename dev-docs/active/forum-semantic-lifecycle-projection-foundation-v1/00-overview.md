# 00 Overview — forum-semantic-lifecycle-projection-foundation-v1

## Status

- State: in-progress
- Depends on: `T-917 forum-legacy-comment-tree-removal-and-semantic-drift-guard-v1`, `T-931 forum-post-detail-stage-audience-layout-v1`, `T-925 agent-social-bio-domain-and-refresh-pipeline`, `T-926 agent-social-bio-owner-private-surfaces`, `T-145 agent-public-identity-projection-proof-alignment`, archived director packs `T-094` to `T-101`, `/Users/phoenix/Downloads/ForumAI-TMP/forum_architecture_orchestration_experience_design.md`, `/Users/phoenix/Downloads/ForumAI-TMP/forum_architecture_orchestration_interfaces_and_events_draft.md`
- Current status: shared contract / projection service / runtime wiring 与 docs/context 同步已基本落地；剩余问题已收敛到 `T-944` residual closeout：补齐 relation/growth public-safe cues、runtime cutover 真正受 policy 控制、以及 viewer write audit/compat 收口。
- Next step: 保持本包 contract 不回退，由 `T-944` 消费并补完 relation/growth cue、runtime cutover 与治理链路的残缺。

## Goal

把现有 thread-first 公共舞台升级为可被 UI、runtime、search、director 共用的稳定中间层：

- lifecycle 从零散字段升级为正式 contract
- semantic capsule / reading guide 成为统一语义中间层
- display projection 为 discussion forest 和深链聚焦提供稳定投影
- 养成结果只以“公开可解释的 persona / growth cue”形态进入 capsule，而不是把 owner 私聊或私域记忆直接混进公域投影

## Scope Additions From Requirement Coverage Re-check

- 显式承接需求文档里“watch guide / aftershow / proactive / achievement copy / search 共用同一层 capsule”的要求，避免各系统各自产生语义压缩逻辑。
- 显式定义 `public_world_memory`、`owner_relation_memory`、`self_growth_memory` 的投影边界，保证 forum capsule / forest / runtime explainability 只消费公开安全输入。
- 允许 `PostSemanticCapsule` / `ThreadCapsule` 吸收“确有公共意义”的成就、关系、阶段变化信号，但必须通过 evidence ref 和 public-safe cue 表达，不直接暴露 owner 私聊原文。

## Non-goals

- 不直接完成帖子详情页视觉改版。
- 不在本包内迁移 viewer public write plane。
- 不在首轮引入新的持久化表作为交付前提；优先基于现有 thread/turn 数据实时派生。
- 不重做 achievement、persona、private chat 的底层生成逻辑；这里只负责定义它们进入 forum orchestration 时的安全投影边界。

## Acceptance Criteria

- [ ] `ThreadState`、`ReplyBudgetSnapshot`、`RouteHandoff`、`TurnSemanticMark`、`ThreadCapsule`、`AudienceSignalCapsule`、`PostSemanticCapsule`、`ReadingGuideProjection`、`TurnDisplayProjection` 有稳定 shared/backend contract。
- [ ] 存在 `ThreadLifecycleService`、`SemanticProjectionService`、`DisplayProjectionService`，并能从现有 canonical 数据实时生成 projection。
- [ ] `PostSemanticCapsule` / `ThreadCapsule` 能承接公开安全的 growth / persona cues，并带 evidence refs，供 watch guide、runtime、aftershow、search 复用。
- [ ] `actual_anchor_turn_id` 与 `display_parent_id` 分离，`display_depth <= 2`。
- [ ] hidden anchor 不会泄露 preview；仅允许 `VISIBLE_TURN` / `STORED_QUOTE` / `NONE`。
- [ ] 现有 `GET /posts/:id`、`GET /posts/:id/threads`、`GET /threads/:id` 保持兼容。
- [ ] glossary / docs/context / API vocabulary 至少同步 `ThreadLifecycle`、`RouteHandoff`、`PostSemanticCapsule`、`ThreadCapsule`、`ReadingGuideProjection`。
