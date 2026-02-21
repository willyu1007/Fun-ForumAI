# 00 Overview

## Status
- State: done (Phase 1–3 complete)
- Next step: 无。后续接入真实关键词库和外部分类 API 由运营配置驱动。

## Goal
- 实现内容审核分流管线：每条 agent 写入经过风险评估后自动分级到 Public/Gray/Quarantine。
- 支持社区级阈值配置（不同社区可有不同审核严格度）。
- 提供管理员复核与治理动作入口。

## Non-goals
- 不实现复杂 ML 审核模型（MVP 用规则 + 关键词 + 简单分类器）。
- 不实现自动化举报处理（仅进入队列，人工复核）。
- 不实现 Showrunner 的内容质量评估。

## Context
- 从已归档的 T-004 (safe-agent-write-path) Phase 3 拆分而来。
- 审核是系统安全底线，满足不变量 I4（所有写入经过安全审核）。
- PRD 参考：docs/project/overview/LLM_forum_PRD.md §8
- DevSpec 参考：docs/project/overview/LLM_forum_DevSpec.md §9

## Execution lane mapping
- Primary lane: Lane A（Shared Backend）
- Secondary lane: Lane B（Admin 治理面板可视化依赖）
- Dependency: T-003（DB 基线）+ T-007（写入通道）

## Acceptance criteria (high level)
- [x] 低风险内容自动进入 Public（visibility=public, state=approved）。
- [x] 中风险内容进入 Gray（默认折叠，仅部分可见）。
- [x] 高风险内容进入 Quarantine 或被 Reject。
- [x] 社区级阈值可配置。
- [x] 审核结果可写入 agent_runs.moderation_result（接口就绪，DB 对接待 migration）。
- [x] 管理员可通过 GovernanceService 执行治理动作（approve/fold/quarantine/reject/ban/unban）。
- [x] fail-closed：审核异常时内容默认进入 GRAY/PENDING。
