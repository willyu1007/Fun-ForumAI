# 00 Overview — media-v1-hardening-contract-lineage-cutover (T-918)

## Status

- State: implemented_verified_pending_db_apply
- Depends on: `T-910 media-framework-audit-and-remediation`, `T-914 visual-media-framework-v1-closure`
- Next step: 在明确目标环境后执行 Prisma migration / lineage backfill，并把 rollout override / lineage trace 放到 staging 做一次带数据验证。

## Goal

把当前 media 主域从“功能闭环已成立但 contract / audit / lineage / naming 仍有软肋”的状态，推进到“语义契约明确、治理 fail-closed、lineage 可追溯、generation 可审计、根帖读侧与媒体 API 已完成强收口”的稳定版本。

## Non-goals

- 不在本任务中开启评论或聊天室的 generation。
- 不引入真正的图像变体/缩略图/EXIF 清洗流水线。
- 不在本任务中把私聊单图能力扩展为多图。

## Context

本轮实现已把 media 域收口到 `asset -> semantic snapshot -> binding -> projection -> plan -> generation job -> attachment` 的可审计闭环，并把 rollout / lineage / contract / naming 的主风险点落到了实际代码路径上。额外在验收阶段又补了 4 个后置修复：

- rollout controller 新增的 `semantic_v3_enforced` / `strict_audit_enforced` / `lineage_required` 不再只是 UI/controller 字段，而是已经被 prompt serialization、surface planning、generation scheduling / execution 消费。
- 清理阶段已移除 legacy `inclination-asset` 写路由、旧本地媒体读别名和对应的 `media_route_primary` 开关，媒体入口只保留 `/media/*` 主路径。
- tiny image 语义提取补了最小尺寸短路，避免 1x1 之类资源再去触发视觉模型并走 provider 侧 400 fallback。
- env / feature naming 已收口到 `FF_MULTIMODAL_AGENT_MEDIA_V1` 主开关，不再保留旧 feature-flag 别名。

## Acceptance Criteria

- [x] 新语义契约 `media_semantic_summary.v3` 成为唯一新写入 schema，历史 `v2` 可只读兼容解析。
- [x] serializer / planner / generation 统一消费显式 `audit_context`，缺失上下文或治理失败时默认 `block`。
- [x] 新增 `MediaLineageEdge` 持久化图谱，关键写路径同步落 edge，且 `ImagePlanSource` 改为强引用。
- [x] generation 改为结构化 spec + compiled prompt，不再以 `prompt_brief` 作为主契约。
- [x] forum root post 读侧不再回退 `post_media`；媒体 API 与本地存储 URL 主路径切到 `media` 命名。
- [x] 补齐 targeted tests、回填脚本与 rollout 开关，并记录验证结果。
