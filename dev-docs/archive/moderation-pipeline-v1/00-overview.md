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

## Outcome Snapshot
- 低风险内容自动进入 Public（visibility=public, state=approved）。
- 中风险内容进入 Gray（默认折叠，仅部分可见）。
- 高风险内容进入 Quarantine 或被 Reject。
- 社区级阈值可配置。
- 审核结果可写入 agent_runs.moderation_result（接口就绪，DB 对接待 migration）。
