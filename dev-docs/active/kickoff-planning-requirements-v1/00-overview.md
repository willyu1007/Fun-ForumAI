# 00 Overview — kickoff-planning-requirements-v1 (T-968)

## Status

- State: in-progress
- Depends on: completed `T-964 kickoff-data-governance-alignment-temp`
- Current status: 首版项目级 `kick-off planning requirement`、`planning review checklist`、流程型 blueprint 与 machine-readable stage blueprint template 已落地。当前 repo 已新增人类可读规则文档 `docs/project/overview/kickoff-planning-requirements.md`、review checklist `docs/project/overview/kickoff-planning-review-checklist.md`、流程蓝图 `docs/project/overview/kickoff-orchestration-blueprint.md`，以及机器可读草案 `config/kickoff/planning/requirements.v1.yaml` 和 `config/kickoff/planning/orchestration-stage-blueprint.template.v1.yaml`。
- Next step: 基于这套 requirement + checklist + blueprint + template，继续把下一版 kickoff orchestration pack 结构化，并决定是否把 planning review 接入 lint / preflight。

## Goal

建立一份项目级 kickoff 规划要求，明确：

1. kickoff 的目标是“话题编排”，不是“凭空发明主角人物”。
2. kickoff 的数量目标、社区覆盖和叙事密度要高于当前 runtime readiness floor。
3. 导演、编剧、视觉三条线各自的输入、输出和禁区是什么。
4. 这份规划要求和现有 `config/kickoff/` 运行合同、`config/launch/` 社区/roster 合同的边界如何划分。

## Non-goals

- 本包不直接重跑 kickoff。
- 本包不直接改 `launch-warm-start.ts` 的内容实现。
- 本包不把 planning requirement 立刻接入强制 lint / import gate。

## Acceptance Criteria

- [x] `docs/project/overview/kickoff-planning-requirements.md` 定义 kickoff 规划目的、适用范围、MUST/SHOULD/MAY 规则、验证方式与例外边界。
- [x] `config/kickoff/planning/requirements.v1.yaml` 提供机器可读草案，冻结数量、议题、角色、视觉与 review gate 的关键约束。
- [x] 规划要求明确 `40-45` 条 root posts 总量目标与每社区 `3-4` 条 root posts 的要求。
- [x] 规划要求明确禁止凭空引入非 roster / 非 canon 的专有角色名。
- [x] 规划要求明确 kickoff 不得在首轮内容内直接收口，必须保留后续追点和未决问题。
- [x] 规划要求明确 kickoff blueprint 必须是流程蓝图，而不是完整剧本。
- [x] `docs/project/overview/kickoff-planning-review-checklist.md` 提供可执行的 planning review checklist。
- [x] `docs/project/overview/kickoff-orchestration-blueprint.md` 提供一份流程型 kickoff blueprint。
- [x] `config/kickoff/planning/orchestration-stage-blueprint.template.v1.yaml` 提供 machine-readable stage blueprint template。
- [x] `04-verification.md` 记录文档一致性检查与 governance sync 结果。
