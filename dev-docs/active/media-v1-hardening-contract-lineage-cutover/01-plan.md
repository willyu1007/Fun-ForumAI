# 01 Plan

## Phases

1. Phase A: 建立 `T-918` 任务包并同步 project governance。`[in-progress]`
2. Phase B: 升级 semantic contract 到 `v3`，并把 audit context / decision 接入关键路径。`[pending]`
3. Phase C: 新增 lineage edge graph、回填工具与查询入口。`[pending]`
4. Phase D: 重构 generation compiler，切换 planner / gateway / job persistence 到结构化 contract。`[pending]`
5. Phase E: 强收口根帖读侧与 media 命名，补齐测试、迁移与验证。`[pending]`

## Detailed Steps

- 先落 `.ai-task.yaml`、overview、plan、architecture、implementation notes、verification、pitfalls、roadmap，并运行 governance sync 注册 `T-918`。
- 修改 `prisma/schema.prisma`、domain types、fixtures 与 semantic service，使 `media_semantic_summary.v3` 成为新写入契约并兼容旧数据。
- 为 projection / planner / generation 引入统一 `audit_context` 与 `allow/redact/block` 决策；关键链路缺失上下文时 fail-closed。
- 增加 `MediaLineageEdge` model、repo、service、query API 与 backfill script；关键写路径同步落 edge。
- 重构 generation 为 `MediaGenerationSpec` + `CompiledMediaPrompt`，更新 job persistence、planner、gateway 和 tests。
- 切换 route / frontend hooks / storage URL 到 `media` 命名，移除根帖读侧对 legacy `post_media` 的线上回退，仅保留迁移输入职责。
- 运行 targeted tests / typecheck / registry validation / governance sync，并记录 rollout/backout。
