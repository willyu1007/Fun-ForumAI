# 01 Plan

## Phases

1. Phase A: 创建 `T-917` bundle、`.ai-task.yaml`、roadmap，并完成 governance 注册。`[completed]`
2. Phase B: 在 `T-916` 完成后冻结 removal inventory、exception policy 与执行期语义收敛检查模式。`[completed]`
3. Phase C: 删除 legacy comment-tree 的 schema/domain/repo/service/route/read model/search/frontend 主链。`[completed]`
4. Phase D: 删除 director / runtime / scene carrier / media / relation / policy / XP / achievement / observability 中残留的 `forum_comment` 语义。`[completed]`
5. Phase E: 在执行期接入 grep 类静态断言或等价测试，证明旧语义已从 active path 清零。`[completed]`
6. Phase F: 运行 repo-wide 验证，证明 active dual-track 已清零。`[completed]`
7. Phase G: 删除晚于 `T-916` 出现的 `PublicStageEntryRepository` / `stage-entry-command` 适配层，并再次确认 thread/turn 主链闭环。`[completed]`

## Detailed Steps

- 先以 `T-916` 的最终 cutover 结果为准，确认所有主路径都已有 thread/turn 替代实现。
- 按 removal inventory 删除 `Comment` 域模型、repo、service、route、thread-context、递归 comment UI、旧搜索 tab、旧 projection 和编码树语义的测试/文档。
- 同步删除 `ForumSceneMetadata.commentId` 一类 comment carrier、`forum_comment` actor surface / prompt scene / source enum、comment evidence ref、comment query key / hook / DTO。
- 删除公开 contract 中的 `parent_comment_id`、`commentId` 和 `/comments/:` 语义，不保留 alias。
- 在执行期增加 repo-wide convergence check：对 `Comment`、`parent_comment_id`、`forum_comment`、`/comments/:`、`commentId=` 以及 comment thread-context / query-key / search item 相关残留建立 grep 类验证。
- 显式列出允许残留 legacy 关键字的目录边界，仅限 archive、one-shot cleanup、migration 工件。

## Implementation Boundaries

- MUST 以 `T-916` 的 `04-verification.md` 中 director/media/relation/source enum 验证通过，作为 `T-917` 的启动门槛。
- MUST 让执行期 convergence check 默认扫描 active code / contract 主链；本次落地为 `src/**`（不含 `__tests__`）、`prisma/schema.prisma`、`docs/context/**`、`.ai/llm-config/registry/prompt_templates.yaml`、`package.json`，并以 targeted regression tests 覆盖直接受影响的测试面。
- MUST 通过显式例外目录控制 archive/migration/one-shot cleanup，而不是靠人工解释单个命中。
- MUST NOT 用“先保留 alias，后续再删”的方式推进 `T-917`；本任务只接受确定性删除与 guard 收口。
- MUST NOT 把过渡 drift script 当成最终交付；当 repo 只剩单套入口时，脚本应一起删除。

## Exit Criteria

- repo 的 active 主路径只剩 `Thread / Turn / Anchor / Route`。
- `04-verification.md` 能证明公开 API/UI/search/runtime 不再依赖 comment-tree。
- director/media/relation/policy/xp/achievement/observability 这些横向链路也不再保留 `forum_comment` 或 comment carrier。
- repo-wide convergence check 已证明旧语义清零；最终仓库不保留独立 drift guard 脚本。
- 没有“暂时保留”的 comment-tree helper、DTO、deep link、scene 名称或 route alias 留在 active 代码路径中。

## Risks & Mitigations

- Risk: 只删除实现，不删除测试、文档、脚本和命名，导致旧语义继续通过搜索和复制粘贴回流。
  - Mitigation: removal inventory 明确覆盖代码、测试、文档、projection、route、deep link 和 runtime naming。
- Risk: 执行期 convergence grep 范围过宽，误伤 archive 或迁移工件。
  - Mitigation: 在架构中明确例外目录，并把验证范围限制在 active path / contract 主链。
- Risk: 在 `T-916` 未完全 cutover 前提前清理，造成主路径断裂。
  - Mitigation: `T-917` 只在 `T-916` 完整完成后启动，不并行执行。
- Risk: 只清理 forum read/write 层，不清理 director/media/source enum，导致 repo 继续以别名方式维持隐性双轨。
  - Mitigation: 把横向链路列入 removal inventory 和 verification contract，不允许被归为“后续整理”。
