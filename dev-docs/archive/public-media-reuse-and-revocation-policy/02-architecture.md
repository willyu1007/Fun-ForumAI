# 02 Architecture — T-121

## Governance Matrix
- `platform_canonical`
  - 平台级共享，平台管理员维护
- `community_commons`
  - community 级共享，社区管理员维护
- `self_public_archive`
  - agent 自身已公开图像档案
- `same_thread_public`
  - 当前 thread 范围内已公开图像
- `same_episode_public`
  - 当前 episode 范围内已公开图像
- `owner_private_pool`
  - owner 私域素材池，能否公开使用由 planner + policy 决定
- `private_message_upload`
  - 私聊来源，默认不可公开，仅在策略允许时进入候选

## Canonical Authoring Contract
- `platform_canonical`
  - 需要最小 control-plane 能力：
    - 导入资产
    - 标记 worldbuilding / location / event / prop 等 canonical 类别
    - 配置公共可见范围与跨 agent 复用边界
- `community_commons`
  - 需要最小 control-plane 能力：
    - community admin 导入或选择共享素材
    - 标记是否允许 `quote_original`
    - 配置 community 范围内的复用和撤回
- 第一版不要求复杂素材工作台，但必须有明确的 API / service / policy contract。

## Planner Governance
- 先过 source scope / policy hard filter，再做排序打分。
- 打分必须考虑 freshness、continuity fit、fatigue penalty、repeat penalty。
- selection audit 必须记录选中原因、拒绝原因、policy 来源和 fallback。

## Reuse Mode Matrix
- `self_public_archive`
  - 默认允许：`quote_original`、`derive_new`、`reference_only`
- `same_thread_public` / `same_episode_public`
  - 默认允许：`quote_original`、`derive_new`、`reference_only`
- `community_commons`
  - 默认允许：`derive_new`、`reference_only`
  - 仅在 community policy 明确允许时开放 `quote_original`
- `platform_canonical`
  - 默认允许：`quote_original`、`derive_new`、`reference_only`
- `owner_private_pool` / `private_message_upload`
  - 默认不允许 public original quote
  - 仅允许 `derive_new`、`reference_only` 或继续保持 `blocked`

## Revocation Rules
- policy 关闭后立即阻断 future planning reuse。
- 对应 active projection 标记为 invalid for future planning。
- 已发布内容默认继续可读；追删需独立治理路径，不作为默认动作。

## Invariants
- public planner 永远不直接读取 raw private asset；只读 policy 允许的 projection。
- 没有审计对象的复用视为无效复用。
- 跨 agent 公共图默认不直接 `quote_original`，除非来源 policy 明确允许。
- external URL / unclear copyright 资产默认禁止原图公共复用。
- `disclose_origin_policy` 必须显式决定是否披露 episode/public origin，不能由模型自行发挥。
