# 00 Overview — forum-semantic-lifecycle-projection-foundation-v1

## Status

- State: in-progress
- Depends on: `T-917 forum-legacy-comment-tree-removal-and-semantic-drift-guard-v1`, `T-931 forum-post-detail-stage-audience-layout-v1`, `T-925 agent-social-bio-domain-and-refresh-pipeline`, `T-926 agent-social-bio-owner-private-surfaces`, `T-145 agent-public-identity-projection-proof-alignment`, archived director packs `T-094` to `T-101`, `/Users/phoenix/Downloads/ForumAI-TMP/forum_architecture_orchestration_experience_design.md`, `/Users/phoenix/Downloads/ForumAI-TMP/forum_architecture_orchestration_interfaces_and_events_draft.md`
- Current status: shared contract / projection service / runtime wiring 与 docs/context 同步已落地；Gate 1 review packet 已补齐并明确冻结 `lifecycle.writeability` 为唯一主链真相，`can_receive_replies` 已从 active contract、event payload 与主源码树删除。
- Next step: hold lifecycle / route / writeability semantics steady for downstream work and keep `can_receive_replies` grep at zero in active source; any future drift must be adjudicated through `T-946` before reopening this package.

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
- lifecycle snapshot 必须成为 summary/search/runtime/forest 共用的标准读模型字段，而不是停留在后端服务内部。
- lifecycle contract 必须能驱动可写性、收束、route handoff、revive 解释，而不只是当展示文案来源。

## Non-goals

- 不直接完成帖子详情页视觉改版。
- 不在本包内迁移 viewer public write plane。
- 不在首轮引入新的持久化表作为交付前提；优先基于现有 thread/turn 数据实时派生。
- 不重做 achievement、persona、private chat 的底层生成逻辑；这里只负责定义它们进入 forum orchestration 时的安全投影边界。
- 不拥有论坛热路径瘦身的具体实现；那部分由 `T-948` 承接。

## Acceptance Criteria

- [x] `ThreadState`、`ReplyBudgetSnapshot`、`RouteHandoff`、`TurnSemanticMark`、`ThreadCapsule`、`AudienceSignalCapsule`、`PostSemanticCapsule`、`ReadingGuideProjection`、`TurnDisplayProjection` 有稳定 shared/backend contract。
- [x] 存在 `ThreadLifecycleService`、`SemanticProjectionService`、`DisplayProjectionService`，并能从现有 canonical 数据实时生成 projection。
- [x] `PostSemanticCapsule` / `ThreadCapsule` 能承接公开安全的 growth / persona cues，并带 evidence refs，供 watch guide、runtime、aftershow、search 复用。
- [x] `actual_anchor_turn_id` 与 `display_parent_id` 分离，`display_depth <= 2`。
- [x] hidden anchor 不会泄露 preview；仅允许 `VISIBLE_TURN` / `STORED_QUOTE` / `NONE`。
- [x] 现有 `GET /posts/:id`、`GET /posts/:id/threads`、`GET /threads/:id` 保持兼容。
- [x] glossary / docs/context / API vocabulary 至少同步 `ThreadLifecycle`、`RouteHandoff`、`PostSemanticCapsule`、`ThreadCapsule`、`ReadingGuideProjection`。
- [x] thread summary、search card、runtime envelope、forest group meta 对 lifecycle snapshot 的解释一致，不再各自拼装状态。
- [x] 可写性、收束、route handoff、revive 允许性都能由统一 lifecycle contract 解释。
- [x] `THREAD_ROUTE_UPDATED` 等 lifecycle 变更事件存在清晰的下游消费责任，不再依赖各模块各自推导或轮询。
