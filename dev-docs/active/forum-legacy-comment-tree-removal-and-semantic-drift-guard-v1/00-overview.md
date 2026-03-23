# 00 Overview — forum-legacy-comment-tree-removal-and-semantic-drift-guard-v1 (T-917)

## Status

- State: planned
- Depends on: `T-916 forum-public-stage-thread-turn-cutover-v1`
- Execution rule: 不与 `T-916` 并行；只在 thread/turn 主链完整 cutover 后启动
- Closure gate: 只有当 active code path、shared DTO、search contract、director/media/relation/policy source enum 都不再出现 comment-tree 主语义时，T-917 才能结束
- Implementation boundary:
  - `T-917` 的启动前提不是“thread UI 已可用”，而是 `T-916` 已完成 director/media/relation/source enum 的 cutover 验证。
  - anti-drift guard 只对 active path 强约束；archive、migration、一次性清理工件必须走显式例外，而不是临时忽略。
- Next step: `T-916` 已完成并归档，thread/turn 公共主链也已完成真实闭环验证；可以按本 bundle 的 removal inventory 和 anti-drift guard 启动 active cleanup

## Goal

彻底删除旧 `Comment` 树方案和所有主动语义入口，并加上长期 guardrail，保证公共舞台在实现、命名、测试、文档和公开 contract 上只剩 `Thread / Turn / Anchor / Route` 一条主线。

## Non-goals

- 不在本任务中承担新的公共舞台能力建设；新能力由 `T-916` 负责。
- 不保留任何面向主路径的 comment-tree 兼容层、兼容别名或兼容 deep link。
- 不把 semantic cleanup 降级为“删除几个文件”的机械整理。

## Context

只做重构而不做彻底移除，会留下长期双轨和语义漂移风险：

- API、测试、文档和 helper 可能继续把 `Comment` 当成公共舞台主语。
- `parent_comment_id`、`forum_comment`、`commentId` 等旧命名会反复被新任务误用。
- 只要 repo 里还存在 active dual-track，新人或 agent 就会继续沿旧语义新增代码。

## Success Criteria

- 公共 API、frontend、search、runtime、director、测试和文档中不再存在 active comment-tree 主路径。
- `Comment`、`parent_comment_id`、`forum_comment`、`/comments/:`、`commentId=` 不再作为公开舞台主语义出现。
- scene carrier、media scene type/evidence、policy/xp/achievement/observability source enum 也不再把 comment-tree 当活动语义。
- anti-drift guard 能对上述旧语义形成持续拦截，并允许 archive / one-shot cleanup / migration 目录作为显式例外。
- 清理后的最终 contract 明确为 `Thread / Turn / Anchor / Route`，任何保留的旧 comment 引用都只能存在于 archive 或一次性清理工件。
