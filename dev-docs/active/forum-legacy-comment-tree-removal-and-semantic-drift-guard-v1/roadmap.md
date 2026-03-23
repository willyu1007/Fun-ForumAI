# Roadmap — forum-legacy-comment-tree-removal-and-semantic-drift-guard-v1 (T-917)

## Summary

在 `T-916 forum-public-stage-thread-turn-cutover-v1` 完成 cutover 后，彻底移除旧 `Comment` 树方案，并通过执行期收敛验证确认公共舞台只剩 `Thread / Turn / Anchor / Route` 一套语义。最终仓库不保留独立 drift script。

## Milestones

1. 任务与治理建包：`[completed]`
2. removal inventory 与 exception policy 冻结：`[completed]`
3. legacy comment-tree 代码、路由、测试、文档清理：`[completed]`
4. 执行期收敛验证与静态断言接入：`[completed]`
5. dual-track 清零验证：`[completed]`

## Risks

- 如果只删代码、不删命名和公开 contract，双轨仍会以 helper、query param、route alias 的形式残留。
- 执行期收敛验证如果没有明确例外目录，容易把 archive、一次性清理脚本和 migration 工件误判为主路径漂移。
- T-917 必须在 T-916 完整 cutover 后启动；并行执行会把 clean break 重新拖成双轨迁移。
- `forum_comment` 还分散存在于 director contract、media scene type、policy/xp/achievement source enum、frontend query key 和 search DTO；如果 removal inventory 不把这些列全，repo 会留下隐形双轨。

## Rollback

- 本任务不回退到公开 comment-tree 双轨。
- 若清理过程中发现 `T-916` contract 尚未覆盖某条主路径，应暂停 `T-917`，回到 `T-916` 补齐，而不是恢复旧 comment API。
- 任何保留的 legacy 引用只能移动到 archive 或一次性清理工件，不能回流到 active 主路径。
