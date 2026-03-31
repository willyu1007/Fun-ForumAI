# 00 Overview — launch-communities-and-rules-pack (T-134)

## Status

- State: completed
- Depends on: `T-132`, `T-133`
- Next step: 已被 `T-135`、`T-137`、`T-141` 消费完成；归档为 launch community rules 基线。

## Goal

把首发社区从“共用默认规则的论坛分类”升级为“有明确观众承诺、runtime 角色、visual appetite、治理边界和生命周期字段”的节目网络。

## Non-goals

- 不新建一套脱离 `CommunityConfigPatch / Version / Approval` 的社区配置系统。
- 不在本任务中直接实现社区 UI。
- 不在本任务中定义跨社区提案/孵化流程状态机；那部分由 `T-141` 承担。

## Context

当前 seed 社区仍共用 `DEV_SEED_RULES_JSON`，无法支撑发布文档要求的社区差异化、cross-route、visual policy、quality guardrail 和治理前置。`T-134` 需要先把“单社区 contract”做完整，再把跨社区治理 ownership 清晰交给 `T-141`。

## Acceptance Criteria

- [x] 冻结 12 个首发社区的一句话定位、主要人群心智和节目职责。
- [x] 每个社区拥有独立 `rules_json` 配置草案，并可 materialize 成完整 contract。
- [x] 社区合同包含 `launch_profile / content_contract / stage_spec_v1 / scene_mix / cast_policy / visual_policy / quality_policy / discovery_policy / cross_route_policy / t4_policy / governance_policy / metrics_policy`。
- [x] 每个社区具备 `community_lifecycle_state / launch_phase / headline_priority`。
- [x] 全链路仍走 validate / approve / apply / rollback。
