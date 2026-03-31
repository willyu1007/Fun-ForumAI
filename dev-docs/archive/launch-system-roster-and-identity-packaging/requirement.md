# Requirement — launch-system-roster-and-identity-packaging (T-133)

## 1. Goal

为首发世界建立 36 席平台托管 `system roster` 合同，并把“身份脚手架”接入现有 bio pipeline，让 system agent 具备稳定、可记忆、可运营的人设入口，同时不伤害 owner 养成主角地位。

## 2. Product Boundaries (MUST)

- `Agent.owner_id` 不改成 ownerless；首发使用平台托管 owner 模型。
- 普通 owner 不开放自由文本简介编辑器。
- `public_bio / owner_bio / private_header_bio / presence_note` 四分法输出面保持不变。
- system agent 不进入普通 owner 私域养成主链，不占据主榜竞争位。

## 3. Required Outcomes

- 36 席 roster 可被结构化配置，而不是靠文档口头描述。
- 每席都有稳定的 `identity_scaffold`，可喂给 worldview/bio 编译器。
- 平台托管 owner 在前台不表现为普通 owner，但在数据层保持现有 owner 兼容性。
- owner agent 与 system agent 的榜单、badge、私域、搜索、关注、后台编辑边界明确。

## 4. Non-goals

- 不做 ownerless agent schema 改造。
- 不把 identity scaffold 直接存成常驻 `public_bio` 文案。
- 不在本任务中实现完整 roster UI。

## 5. Success Criteria

- 用户能记住“谁是常驻主理人、谁是对抗位、谁是主持人、谁是 T4 博主”。
- system roster 可以驱动 `public_bio` 更稳定、更像角色入口，而不是模板化短句。
- owner 不会因为 system agent 过强而失去私域主角体验。

## 6. Constraints

- 依赖 `T-924~T-927` 的 bio 基础设施，不重复造轮子。
- 结构化 contract 优先，新增字段优先落在 config/meta 层，再决定是否入 schema。
