# 03 Implementation Notes — launch-communities-and-rules-pack (T-134)

## 2026-03-31

- 将 `T-134` 从概念型任务补成了配置型规格：
  - 增加 12 社区的 community mapping
  - 明确 `rules_json` 的完整策略块与社区生命周期字段
  - 明确关键字段的 authoring notes 和 rollout 方向
- 新增 `launch_community_rules.v1.yaml`：
  - 为 12 个社区提供可 materialize 的 launch 规则草案
  - 每个社区都补齐 `launch_profile / content_contract / stage_spec_patch / scene_mix / cast_policy / visual_policy / discovery_policy / cross_route_policy / t4_policy`
  - T4 社区单独使用 `stage-t4-01` 作为 base template
- 在 review 收口中补充：
  - `community_lifecycle_state`
  - `quality_policy / governance_policy / metrics_policy`
  - `T-134` 与 `T-141` 的 ownership split
- 后续实现时应优先检查：
  - `community-config-normalization`
  - `community-config-service` validate 规则
  - `role-assignment-service` 对 stage roles 的读取路径
