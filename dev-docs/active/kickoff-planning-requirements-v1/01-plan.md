# 01 Plan — kickoff-planning-requirements-v1 (T-968)

## Scope

### In

- 项目级 kickoff 规划要求文档
- 项目级 kickoff orchestration blueprint
- machine-readable stage blueprint template
- 机器可读 planning requirement 草案
- 与现有 kickoff / launch contract 的边界说明

### Out

- 真实 kickoff 内容重写
- warm-start runtime 代码改造
- admin / verify gate 接线

## Steps

1. 盘点现有 kickoff contract 与当前缺口。
2. 起草项目级 planning requirement 文档。
3. 起草 YAML 草案以承接关键 planning rules。
4. 起草 planning review checklist，并把 blueprint 形式改写为 orchestration flow。
5. 起草流程型 kickoff orchestration blueprint。
6. 起草 machine-readable stage blueprint template。
7. 记录验证与治理同步结果。

## Draft Rules To Freeze

- 总量目标：`40-45` 条 root posts。
- 社区覆盖：每个社区 `3-4` 条 root posts。
- 主体单位：以 `topic cluster` 为核心，不以“临时创造的人物关系”起盘。
- 角色边界：禁止非 roster / 非 canon 专有角色名直接进入 kickoff。
- 叙事边界：首轮 kickoff 只负责建立关注和分歧，不负责完整收口。
- 视觉边界：每条图要服务具体话题/场景，不允许用社区 banner 充当主题封面。
- 蓝图边界：kickoff blueprint 必须描述触发节点、责任角色、输入/输出与交接，不得写成完整剧本。

## Verification Target

- 文档与 YAML 字段一致。
- 所有 MUST 规则都可映射到后续实现或人工 review。
- 不与现有 `config/kickoff/manifest.v1.yaml`、`config/launch/*.yaml` 语义冲突。
