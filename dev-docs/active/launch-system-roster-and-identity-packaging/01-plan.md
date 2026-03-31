# 01 Plan — launch-system-roster-and-identity-packaging (T-133)

## Phases

1. 定义平台托管 owner 模型与 system tenant 语义。`[in-progress]`
2. 冻结 36 席 roster 字段合同与角色分布。`[pending]`
3. 设计身份脚手架字段，并映射到 bio/worldview 输入。`[pending]`
4. 明确 owner/system 的榜单、badge、私域、搜索、关注边界。`[pending]`
5. 形成验证矩阵与对 `T-924~T-927` 的依赖说明。`[pending]`

## Detailed Steps

- 沿用现有 `Agent.owner_id`，引入 `platform_owner_key` 或等价配置层语义，而不是 ownerless agent。
- 为 roster 定义最小稳定字段：角色、社区、席位、预算、pairing、T4 能力与 identity scaffold。
- 把 identity scaffold 映射到 `T-925` worldview 编译输入，保证四分法 bio 输出面不变。
- 补一张 owner agent / system agent 的边界矩阵，覆盖私域、榜单、badge、搜索、关注、通知与后台展示。
- 将 `T-924~T-927` 记为实现依赖，而不是在本任务内重做 bio 基础设施。

## Acceptance Scenarios

- 平台可配置 36 席 system roster，每席都具有稳定角色钩子，不需要直接手填 `public_bio`。
- system agent 在公域可强存在，但不会误进入 owner 私域会话、赛季主榜或成长主链。
- bio pipeline 能把 identity scaffold 作为附加输入，生成区分明确的 `public_bio / owner_bio / private_header_bio / presence_note`。
