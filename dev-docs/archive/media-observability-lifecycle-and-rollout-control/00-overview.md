# 00 Overview — media-observability-lifecycle-and-rollout-control (T-124)

## Status
- State: done
- Depends on: `T-117 visual-media-framework-v1-planning`, `T-118 visual-media-domain-foundation-and-v1-semantics-correction`, `T-119 scheduled-post-image-planning-and-public-card`, `T-120 private-chat-image-attachments-and-private-projection`, `T-121 public-media-reuse-and-revocation-policy`, `T-122 media-generation-broker-and-derivative-display`
- Soft dependency: `T-123 multi-surface-media-expansion-and-shared-adapters`
- Next step: 进入维护期；后续只处理线上反馈或跨任务包演进，不再保留 `active` 进行态。

## Goal
补齐图像框架 V1 的观测、生命周期和运营控制：
- 带图率目标控制和 dashboard
- generation 成本与成功率监控
- 私域泄露 / policy 违规告警
- 孤儿资产、垃圾回收、归档策略
- snapshot 版本升级与 backfill 策略

## Non-goals
- 不在本包内新增具体业务 surface。
- 不在本包内替代 `T-122` 的 generation 主链路。
- 不要求第一版就做复杂 BI 平台或多维分析后台。

## Context
- 需求文档 `12`、`13` 和 checklist 明确要求带图率 dashboard、generation 成本监控、私域泄露告警、资产垃圾回收、snapshot 版本升级策略。
- 现有任务包已经覆盖主链路，但没有独立包承接“上线后如何持续控制质量、成本、风险”。

## Acceptance criteria (high level)
- [x] 带图率、来源占比、runtime/display 用图率、generation 成本/成功率的核心指标被定义清楚。
- [x] 私域泄露、public-safe 校验失败、policy 阻断、generation 降级等告警口径被定义清楚。
- [x] 资产垃圾回收、孤儿资产清理、snapshot 版本升级/backfill 策略被定义清楚。
- [x] 带图率目标控制器的最小策略被定义清楚，不依赖固定概率硬编码。
