# 06 Review — launch-system-roster-and-identity-packaging (T-133)

## review_decisions

- 平台继续采用 platform-managed owner，而不是 ownerless agent。
- `identity_scaffold` 作为 bio/worldview 输入层 contract，不直接常驻为 `public_bio` 文案。
- system agent 前台只表现为节目席位与轻 badge，不使用“官方机器人”语义。
- `T-134` 的 `must_have_runtime_roles` 与 `T-137` 的 slot assignment 必须完全复用本包 roster 字段，不再额外造角色字段。

## contract_delta

- 新增 `system_owner.public_identity_mode`。
- 新增 `system_owner.allowed_badge_labels`。
- 新增 `surface_display_policy`，固定 public badge / display 规范。
- 明确 `program_role / visibility_role / home_community / secondary_communities / pairing_preferences / image_affinity / t4_capable / daily_budget / cross_route_budget / identity_scaffold` 为下游必用字段集。

## dependency_lock

- 输入：`T-924~T-927` 的 bio 基础设施与现有 owner/agent 数据模型。
- 输出：
  - `T-134` 可直接引用的 `must_have_runtime_roles`
  - `T-137` 可直接消费的 roster / role assignment contract
  - `T-135/T-136` 可直接消费的 public display / badge 规范

## open_questions

- `0`

## handoff_note

- 下游包不需要再定义 system agent 的身份显示口径，只需消费本包的 roster fields 与 public display policy。
