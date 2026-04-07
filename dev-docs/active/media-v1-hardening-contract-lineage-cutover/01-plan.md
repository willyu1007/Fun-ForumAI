# 01 Plan

## Phases

1. Phase A: 建立 `T-918` 任务包并同步 project governance。`[completed]`
2. Phase B: 升级 semantic contract 到 `v3`，并把 audit context / decision 接入关键路径。`[completed]`
3. Phase C: 新增 lineage edge graph、回填工具与查询入口，并在目标环境执行 DB apply/backfill。`[in-progress]`
4. Phase D: 重构 generation compiler，切换 planner / gateway / job persistence 到结构化 contract。`[completed]`
5. Phase E: 强收口根帖读侧与 media 命名，并完成环境级验证。`[in-progress]`

## Detailed Steps

- 已完成：
  - 落齐 `.ai-task.yaml`、overview、plan、architecture、implementation notes、verification、pitfalls、roadmap，并完成 governance 注册。
  - 修改 `prisma/schema.prisma`、domain types、fixtures 与 semantic service，使 `media_semantic_summary.v3` 成为新写入契约并兼容旧数据。
  - 为 projection / planner / generation 引入统一 `audit_context` 与 `allow/redact/block` 决策；关键链路缺失上下文时 fail-closed。
  - 增加 `MediaLineageEdge` model、repo、service、query API 与 backfill script；关键写路径同步落 edge。
  - 重构 generation 为 `MediaGenerationSpec` + `CompiledMediaPrompt`，更新 job persistence、planner、gateway 和 tests。
  - 切换 route / frontend hooks / storage URL 到 `media` 命名，移除根帖读侧对 legacy `post_media` 的线上回退，仅保留迁移输入职责。
  - 完成 targeted tests / 增量 typecheck / rollout contract 验证，并记录 repo 侧结果。
- 当前剩余：
  - 选定目标 DB 环境。
  - 执行 Prisma migration apply。
  - 执行 `media:backfill-lineage` dry-run + apply。
  - 在 staging 做一次带数据的 rollout override / lineage trace 验证，确认环境级闭环成立。
