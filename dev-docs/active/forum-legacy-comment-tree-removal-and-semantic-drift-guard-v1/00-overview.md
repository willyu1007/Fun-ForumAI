# 00 Overview — forum-legacy-comment-tree-removal-and-semantic-drift-guard-v1 (T-917)

## Status

- State: done
- Depends on: `T-916 forum-public-stage-thread-turn-cutover-v1`
- Execution rule: 不与 `T-916` 并行；只在 thread/turn 主链完整 cutover 后启动
- Closure gate: 只有当 active code path、shared DTO、search contract、director/media/relation/policy source enum 都不再出现 comment-tree 主语义时，T-917 才能结束
- Implementation boundary:
  - `T-917` 的启动前提不是“thread UI 已可用”，而是 `T-916` 已完成 director/media/relation/source enum 的 cutover 验证。
  - 过渡期语义收敛检查只用于执行阶段；当 active path 已物理收敛为单入口后，repo 内不再保留独立 drift script。
- Next step: 无；已额外删除晚于 `T-916` 引入的 `PublicStageEntryRepository` / `stage-entry-command` 适配层，并在 thread/turn 主链闭环后移除过渡 `check-forum-stage-semantics-drift.mjs`。

## Goal

彻底删除旧 `Comment` 树方案和所有主动语义入口，保证公共舞台在实现、命名、测试、文档和公开 contract 上只剩 `Thread / Turn / Anchor / Route` 一条主线。执行过程中允许使用一次性收敛检查，但最终仓库不保留独立 drift guard 入口。

## Non-goals

- 不在本任务中承担新的公共舞台能力建设；新能力由 `T-916` 负责。
- 不保留任何面向主路径的 comment-tree 兼容层、兼容别名或兼容 deep link。
- 不把 semantic cleanup 降级为“删除几个文件”的机械整理。

## Context

只做重构而不做彻底移除，会留下长期双轨和语义漂移风险：

- API、测试、文档和 helper 可能继续把 `Comment` 当成公共舞台主语。
- `parent_comment_id`、`forum_comment`、`commentId` 等旧命名会反复被新任务误用。
- 只要 repo 里还存在 active dual-track，新人或 agent 就会继续沿旧语义新增代码。

## Acceptance Criteria

- [x] 公共 API、frontend、search、runtime、director 主链已收敛到 `Thread / Turn / Anchor / Route`，不再暴露 comment-tree 主语义。
- [x] `Comment`、`parent_comment_id`、`forum_comment`、`/comments/:`、`commentId=`、`agent-reply-to-comment`、`comment_report` 不再出现在 active code / registry / context contract 主链。
- [x] `ForumSceneMetadata`、scene carrier、forum read/write/runtime/event bridge 已以 `thread_id` / `turn_id` 与显式 `THREAD` / `TURN` contract 直连，不再保留 `PublicStageEntryRepository` / `stage-entry-command` 一类运行期适配层。
- [x] repo-wide grep/static verification 已证明 active code / contract 主链不再出现 `Comment`、`stage_entry`、`comment_count`、`agent-reply-to-stage-entry` 等旧/过渡语义，且过渡 drift script 已删除。
- [x] `pnpm exec tsc --noEmit`、`pnpm prisma validate`、`node .ai/scripts/ctl-db-ssot.mjs sync-to-context` 与 targeted regression tests 已通过。

## Success Criteria

- 公共 API、frontend、search、runtime、director、测试和文档中不再存在 active comment-tree 主路径。
- `Comment`、`parent_comment_id`、`forum_comment`、`/comments/:`、`commentId=` 不再作为公开舞台主语义出现。
- scene carrier、media scene type/evidence、policy/xp/achievement/observability source enum 也不再把 comment-tree 当活动语义。
- 过渡 drift check 已完成使命并被移除；最终仓库依赖单入口 contract、repo-wide convergence grep 与 targeted regression tests 证明不会回流到旧语义。
- 清理后的最终 contract 明确为 `Thread / Turn / Anchor / Route`，任何保留的旧 comment 引用都只能存在于 archive 或一次性清理工件。
