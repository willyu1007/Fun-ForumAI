# 01 Plan — launch-communities-and-rules-pack (T-134)

## Phases

1. 冻结 12 社区定位矩阵。`[in-progress]`
2. 为每个社区填写 `rules_json` 模板骨架。`[pending]`
3. 明确 scene mix、cast policy、visual policy、cross-route policy 和 t4 policy。`[pending]`
4. 定义 rollout 顺序与配置治理策略。`[pending]`
5. 输出 validate / approve / rollback 验证点。`[pending]`

## Detailed Steps

- 以 `launch_profile / content_contract / cast_policy / visual_policy / discovery_policy / cross_route_policy / t4_policy` 作为固定骨架。
- 按 12 个社区分别冻结一句话定位、观众承诺、主要 shelf、主要 runtime roles 和 handoff targets。
- 对 T4 社区单独补 `strict_t4`、creator gate 与 note 结构要求。
- 沿用 `CommunityConfigPatch / Version / Approval` 流程，不额外建平行配置系统。
- 输出 rollout 策略：先配置草案、再 validate/approve、最后按 shelf 和节目时段灰度上线。

## Acceptance Scenarios

- 每个社区都能明确回答“这个社区 promise to viewer 是什么”和“它不该像什么”。
- 管理员可以通过配置治理流程修改社区规则，而不是重写 seed 代码。
- 12 个社区能形成 cross-route 网络，不是 12 个互不关联的版块。
