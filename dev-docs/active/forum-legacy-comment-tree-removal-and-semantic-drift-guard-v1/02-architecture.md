# 02 Architecture

## Final Contract

- 公共舞台只允许 `Thread / Turn / Anchor / Route` 一套语义。
- `Comment` 不再是公共舞台的活动域概念。
- 任何保留的旧 comment 引用都只能存在于 archive、one-shot cleanup 或 migration 工件中。

## Removal Inventory

- 删除 `Comment` 域模型、repository、service、route。
- 删除 `parent_comment_id` 的公开 contract 与相关 DTO/validation。
- 删除 `forum_comment` scene / event / callsite 命名。
- 删除 `commentId` deep link 语义。
- 删除 comment thread-context 逻辑与对应接口。
- 删除递归 comment UI。
- 删除旧 comment search tab、docs、projection。
- 删除仍然编码树语义的测试与文档。
- 删除 comment carrier 字段与查询入口，例如 `ForumSceneMetadata.commentId` 一类 post/comment sidecar 读写路径。
- 删除 `forum_comment` actor surface、prompt scene、overlay-engine allowlist、dev prompt render 入口。
- 删除 comment evidence ref、`forum_comment` media scene type、comment attachment lookup 与相关 visual directive/source mapping。
- 删除以 `forum_comment` 或 `Comment` 为枚举值/类型名的 policy、safe-reply、XP、achievement、observability、prompt override、admin runtime 共享 contract。
- 删除 frontend query keys、hooks、API types、search shared contract 中的 comment 主路径条目。

## Anti-drift Guard

- 对以下模式建立持续静态断言或 grep 类测试：
  - `Comment`
  - `parent_comment_id`
  - `forum_comment`
  - `/comments/:`
  - `commentId=`
- 对以下高风险残留建立附加断言：
  - `commentThreadContext`
  - `useCommentThreadContext`
  - `SearchCommentItem`
  - `commentSearchDoc`
  - `CommentList`
- guard 目标是阻止这些关键字重新进入公共舞台主路径，而不是阻止历史 archive 存在。
- guard 需要明确例外目录，并将例外写死在规则中，避免实现者靠临时忽略规避治理。
- guard 的默认扫描范围应覆盖 `src/**`、`shared/**`、`prisma/schema.prisma`、`docs/context/**` 和相关测试；不依赖人工 spot-check。

## Exception Policy

- 允许保留 legacy 关键字的目录只限 archive、one-shot cleanup、migration 工件。
- `dev-docs` 中的历史记录可保留任务上下文，但不能被误写成 active contract。
- `prisma/migrations/**`、`dev-docs/archive/**`、一次性清理脚本目录和明确标记的 archive 工件可作为 guard 例外。
- 任何 active 代码路径、共享 DTO、对外 API、frontend route、runtime scene、search contract 都不在例外范围内。

## Verification Contract

- 公开 API/UI/search 不再依赖 comment-tree。
- runtime 中不存在 active `forum_comment`。
- 对外 contract 中不存在 `parent_comment_id` 或 `commentId`。
- anti-drift guard 能在新增旧语义时失败。
- active code path 中不存在 comment carrier、comment media surface、comment query key 或 comment search doc 主链。

## Dependency Rules

- `T-917` 只能在 `T-916` 完整 cutover 后执行。
- 若发现某条主路径仍依赖 legacy comment-tree，应把缺口回填到 `T-916`，而不是在 `T-917` 保留临时兼容。
- 清理后的 repo 不得重新引入 comment-tree alias、bridge 或 adapter。

## Open Questions

- 无。`T-917` 的职责是 semantic cleanup 与 anti-drift guard，不是继续讨论双轨保留策略。
