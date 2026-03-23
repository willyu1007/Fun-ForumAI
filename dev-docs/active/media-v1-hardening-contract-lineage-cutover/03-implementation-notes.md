# 03 Implementation Notes

## Status

- Current status: `implemented_verified_pending_db_apply`
- Last updated: 2026-03-24

## What changed

- 2026-03-24: 建立 `T-918` 任务包，锁定本轮目标为 semantic v3、strict audit、lineage graph、generation compiler 与 media 命名收口。
- 2026-03-24: semantic summary 升级为 `media_semantic_summary.v3`，保留历史 flat 字段读取兼容；vision prompt 模板和配置目标版本同步切到 v3。
- 2026-03-24: 引入 `MediaAuditContext` / `MediaAuditDecision` / `evaluateMediaAudit()`，public/private serializer 默认 fail-closed，surface/post scheduler 显式传审计上下文。
- 2026-03-24: 引入 `MediaGenerationSpec` / `CompiledMediaPrompt`，planner、gateway、generation job 持久化链路改为结构化 prompt 编译。
- 2026-03-24: 新增 `MediaLineageEdge` repo/service/model；binding / projection / image plan / generation job / post_media 写路径同步落边；admin 增加 lineage trace 查询入口。
- 2026-03-24: root post 读侧切到 attachment/projection 为唯一权威来源；agent media API 与本地媒体读取只保留 `/media/*` 主路径，legacy route alias 已删除。
- 2026-03-24: 增加 `src/backend/dev/backfill-media-lineage.ts` 与手写 Prisma migration，用于历史 generation artifact + lineage edge 回填。
- 2026-03-24: 回填脚本 edge kind 对齐 live-write 语义，补上 `generated_asset_described_by_snapshot` 等边，避免 backfill graph 与实时 graph 漂移。
- 2026-03-24: rollout controller 的 `semantic_v3_enforced` / `strict_audit_enforced` / `lineage_required` 不再停留在控制面字段，已经接入 prompt serialization、surface planning、generation scheduling / execution。
- 2026-03-24: `MediaSemanticService` 对小于 provider 最小尺寸的图片直接短路 fallback，并记录 `vision_dimensions_below_min`，避免无效视觉模型调用。
- 2026-03-24: backend / frontend feature naming 收口到 `FF_MULTIMODAL_AGENT_MEDIA_V1`，删除旧 `FF_MULTIMODAL_AGENT_INCLINATION_V1` feature-flag 别名。
- 2026-03-24: 深度清理阶段移除了 legacy `inclination-asset` 写路由、旧本地媒体读 alias、`media_route_primary` rollout 字段，以及 dev-only 的 media e2e/highlights sample runner。

## Known issues / follow-ups

- Prisma migration 仅已写入 repo，尚未对任何目标数据库执行 `migrate deploy/dev`。
- `media:backfill-lineage` 已实现但未在实际数据库上执行；需要在明确目标环境后先 dry-run，再正式回填。
- 仓库仍有与本任务无关的历史 TypeScript 噪音，因此当前验证以 media 相关增量 typecheck + targeted vitest 为准。
- Chrome DevTools MCP 本轮因本地 profile lock 未能接管浏览器，真实验收改用本地 dev server + authenticated HTTP + session log 方式完成。
