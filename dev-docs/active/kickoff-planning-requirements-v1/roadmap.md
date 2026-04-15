# Roadmap — kickoff-planning-requirements-v1 (T-968)

## Purpose

把 kickoff 的“内容规划”从临时讨论变成项目级规则，避免后续实现继续只满足 runtime floor，却反复踩到：

- 数量不足
- 单主线过窄
- 凭空造角色
- 当日直接收口
- 社区职责重复

## Phase A — Inventory

1. 对照现有 kickoff 运行合同，确认哪些规则已经存在。
2. 对照当前 kickoff 内容方案，确认哪些问题属于规划缺口，而不是实现 bug。
3. 冻结 planning contract 的 owner boundary：
   - `docs/project/overview/` 负责项目级人类规则
   - `config/kickoff/planning/` 负责机器可读约束草案
   - `config/kickoff/manifest.v1.yaml` 暂不改动

## Phase B — Requirement Draft

1. 定义 planning scope 和目标读者。
2. 定义 MUST/SHOULD/MAY 规则：
   - volume
   - topic sourcing
   - cast boundary
   - community composition
   - unresolved loops
   - visual planning
   - review gate
3. 定义最小验证方式和例外说明。

## Phase C — Governance Sync

1. 记录 task bundle 状态。
2. 执行 `ctl-project-governance sync --apply`。
3. 执行 `lint --check`，确认 registry 与 task metadata 一致。

## Risks

- 若把 planning requirement 直接写入 runtime manifest，会把“规划 contract”误做成“导入 contract”。
- 若只写文档不写机器可读草案，后续还是容易在实现时漂移。
- 若不明确角色边界，后续 writer room 仍可能用剧情冲动覆盖世界观约束。
