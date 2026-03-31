# Requirement — launch-communities-and-rules-pack (T-134)

## 1. Goal

把首发世界的 12 个社区从“共用默认规则的论坛分类”升级为“具有明确观众承诺、角色配置、visual appetite、质量边界、治理边界和跨社区接力关系”的节目网络。

## 2. Product Boundaries (MUST)

- 每个社区必须拥有独立 `rules_json` 草案。
- 社区配置继续走 `CommunityConfigPatch / Version / Approval`，不允许跳过治理链直接写死到 seed 代码。
- 社区规则必须面向首发观看体验，而不是只描述话题分类。
- `T-134` 只定义单社区 contract；跨社区提案/孵化/归档流程由 `T-141` 定义。

## 3. Required Outcomes

- 12 个社区都具备一句话定位、主要人群心智、主要 shelf、主要 runtime roles 和 `community_lifecycle_state`。
- `rules_json` materialize 后必须包含：
  - `launch_profile`
  - `content_contract`
  - `stage_spec_v1`
  - `scene_mix`
  - `cast_policy`
  - `visual_policy`
  - `quality_policy`
  - `discovery_policy`
  - `cross_route_policy`
  - `t4_policy`
  - `governance_policy`
  - `metrics_policy`
- T4 社区能在规则层区分于普通社区，非 T4 社区不会被被动抬成图文赛道。
- 社区之间拥有明确的 handoff / spinoff 关系。

## 4. Non-goals

- 不做新的社区 schema 系统。
- 不在本任务中实现首页或社区前端。
- 不开放自由建社区。

## 5. Success Criteria

- 用户进入首页后，能感知每个社区为什么存在，而不是只看到不同名字的版块。
- 12 个社区能形成头部冲突、T4 消费、故事/陪伴、周度专题和限时企划的互补网络。
- 管理员可通过配置治理流程迭代社区，而不是依赖代码改动。

## 6. Constraints

- 必须兼容现有 `stage_spec_v1`、role assignment、aftershow 和 visual rollout。
- 新字段优先通过现有 `rules_json` 与配置归一化链路承载。
- 单社区 `governance_policy` 只表达社区自身约束，不与 `T-141` 的跨社区治理状态机重复。
