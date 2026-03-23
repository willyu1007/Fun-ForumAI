# 03 Implementation Notes

## Initialization

- 2026-03-23: 创建 `T-917` 标准 bundle，并把任务状态置为 `planned`。
- 2026-03-23: 明确该任务只在 `T-916` 完整 cutover 后启动，不并行执行。
- 2026-03-23: 第二轮复核把 director/media/relation/source-enum 清理纳入 removal inventory，避免只删主链代码留下隐形双轨。

## Frozen Decisions

- `T-917` 是 semantic cleanup，不是机械删除。
- 清理后的 repo 不保留 comment-tree 主路径 alias。
- 语义收敛验证是执行期工具，不是最终长期入口；最终仓库必须只剩 thread/turn 单入口。

## Implementation Notes To Fill During Execution

- 2026-03-23: 冻结 active-path inventory。确认残留不止于历史文档，仍包括：
- Prisma `Comment` 模型与 `ForumSceneMetadata.commentId` carrier。
- backend `CommentRepository` / `Comment` DTO 兼容层，以及 `ForumReadService` 的 `getComments/getComment/getCommentThreadContext`。
- frontend `CommentList` 与 `src/frontend/api/types.ts` 中的 comment tree DTO。
- runtime / relation / search / digest / membership / governance 等横向链路对 `commentRepo`、`comment_id`、`comment_kind` 的 active 依赖。
- 2026-03-23: 删除 Prisma `Comment` 模型、`ForumSceneMetadata.commentId` carrier、legacy `CommentRepository`/`CommentList`/旧 thread-context read path，并先用 thread/turn DTO 收敛公共舞台主链。
- 2026-03-23: 将 governance/runtime/search/frontend shared contract 统一为 `stage_entry` / `THREAD` / `TURN`，并把公开计数 contract 从 `comment_count` 收敛为 `stage_entry_count`。
- 2026-03-23: 将 active runtime prompt template id 从 `agent-reply-to-comment@4` 收敛为 `agent-reply-to-stage-entry@4`，同步更新 prompt registry、callsite inventory 与 dev prompt render/e2e 验证。
- 2026-03-23: 新增 `scripts/check-forum-stage-semantics-drift.mjs` 与 `pnpm forum:stage-drift:check`，扫描 `src/**`（排除 `__tests__`）、`prisma/schema.prisma`、`docs/context/**`、`.ai/llm-config/registry/prompt_templates.yaml`，显式允许 archive/migration/test 工件作为例外边界。
- 2026-03-23: 运行 `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`，刷新 `docs/context/db/schema.json`，清除旧 `Comment/commentId` 合同残留。
- 2026-03-23: 补齐 `scripts/lib/director-history-shared.mjs` 的 schema 跟随改造，把历史 review sample / archive 路径从 `commentId` 切到 `threadId/turnId`，避免维护脚本继续绑定旧 schema。
- 2026-03-23: 通过 TypeScript、Prisma、semantic drift guard 与 targeted regression tests 完成闭环验证。
- 2026-03-23: 根据实现复核结果，继续删除晚于 `T-916` 引入的 `PublicStageEntryRepository`、`PgPublicStageEntryRepository` 与 `stage-entry-command.ts`，把 `ForumWriteService`、`PublicSceneWriteRepository`、`EventBridge`、`GovernanceAdapter`、`RelationService`、`SearchProjectionService` 等主链全部改回显式 `publicStageThreadRepo + publicStageTurnRepo`。
- 2026-03-23: 为避免重新引入 repo 级泛化适配层，新增 `src/backend/lib/public-stage-thread-turn.ts` 作为 thread/turn 纯 helper，并在测试侧增加 `src/backend/test-support/public-stage-store.ts` 以替代被删除的 in-memory comment adapter。
- 2026-03-23: 清理并重写受影响测试，删除旧 `comment-repository.test.ts`，同步把 forum/runtime/search/governance 相关定向回归切到 T-916 的 `thread / turn` 语义。
- 2026-03-23: 复核后确认 `stage_entry` 仍属于过渡语义；继续把 active path 收敛为 `thread / turn`，同步把 `stage_entry_count`、`agent-reply-to-stage-entry`、`representative_stage_entry_text` 等命名收回 `thread_turn_*` 或显式 thread/turn contract。
- 2026-03-23: 在 active path、registry、search contract 与 package script 全部收敛后，删除 `scripts/check-forum-stage-semantics-drift.mjs` 与 `pnpm forum:stage-drift:check`，改以 repo-wide convergence grep 作为任务验证证据，而不是保留第二套流程入口。
