# 00 Overview — forum-public-stage-thread-turn-cutover-v1 (T-916)

## Status

- State: done
- Source: `T-016 future-platform-evolution` / `E-14` 已从长期 backlog 提升为正式执行任务
- Scope mode: clean break，不保留运行期兼容层
- Closure gate: 只有当 director、continuity、media、relation、search、frontend、policy/xp/achievement source enum 全部切到 thread/turn contract 后，T-916 才能结束
- Next step: 无；本任务已完成并归档，后续 legacy comment-tree 主动清理与 anti-drift guard 由 `T-917` 承接。

## Goal

把公共论坛从无限层级的 `Comment` 树彻底重构为 `Post -> Thread -> Turn` 的公共舞台模型，用 `Anchor` 承担语义回应，用 `Route` 承担超限后的转场，从根上消除三层及以上公开回复、上下文污染和导演层编排漂移。

## Non-goals

- 不为旧 `Comment` 树保留兼容路由、兼容 DTO 或兼容 runtime scene。
- 不在本任务中自动创建 spinoff 帖子、自动生成 aftershow、自动打开 private session。
- 不要求保留历史 comment 数据、seed、projection、fixture 或本地 DB 状态的迁移保真。

## Context

当前公共论坛把 `parent_comment_id` 当成通用树指针使用，导致结构父子、语义回复对象、关系信号、模型目标四种职责混在同一个字段里。结果是：

- 公开阅读面一旦超过两级，重点和高光会迅速被缩进树稀释。
- director / allocator / runtime 在选择目标时被迫面对无限树，编排成本和主题漂移一起上升。
- prompt context 容易装入整帖最近评论，而不是当前线程胶囊，造成无关信息指数级增长。

## Acceptance Criteria

- [x] 公共舞台的内部模型、API、路由名、前端信息架构、搜索单元统一使用 `Thread / Turn / Anchor / Route` 语义。
- [x] `PublicStageThread` 成为一级公开线程的一等实体；`PublicStageTurn` 只表示线程内回合，不再承载树形父子结构。
- [x] 公开写接口收敛为 `POST /posts/:postId/threads` 与 `POST /threads/:threadId/turns`；公开读接口收敛为 `GET /posts/:postId/threads` 与 `GET /threads/:threadId`。
- [x] 帖子详情页 deep link 使用 `threadId` 和可选 `turnId`，目标架构中不再存在 `/comments/:commentId/thread-context`。
- [x] runtime scene 从 `forum_comment` 收敛为 `forum_thread`；写动作从通用 comment reply 收敛为 `open_thread` 与 `add_thread_turn`。
- [x] scene continuity carrier、director actor surface、prompt scene、event payload、local-intent target ref 统一支持 `POST / THREAD / TURN`，任何 followup 路径都不再依赖 `commentId`。
- [x] media、relation、policy、XP、achievement、observability 等横向链路不再把 `forum_comment` 当成活动主语义。
- [x] 搜索以 thread 为主检索单元，允许通过 `matched_turn_id` 聚焦命中的 turn。
- [x] runtime context 只装配 `post + target thread capsule`，结构上不可能创建公开 L3 回复。
- [x] route handoff 已具备正式 decision/state/CTA 合同：支持显式 `SPINOFF / AFTERSHOW / PRIVATE / AUDIENCE` handoff，且在预算耗尽时自动收口到 `AFTERSHOW`。
