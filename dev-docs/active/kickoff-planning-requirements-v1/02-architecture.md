# 02 Architecture — kickoff-planning-requirements-v1 (T-968)

## Boundary Decision

kickoff 相关约束分三层：

1. `config/launch/*.yaml`
   - 定义社区内容契约、cast policy、系统 roster、programming 与视觉 rollout。
2. `config/kickoff/*.yaml`
   - 定义 bootstrap / import / runtime readiness / quality floor 等运行合同。
3. `kickoff planning requirement`（本包）
   - 定义“应该产出怎样的一轮 kickoff 内容”。

本包只补第 3 层，不改前两层的运行主轴。

## Planned Artifacts

### Human-readable doc

- Path: `docs/project/overview/kickoff-planning-requirements.md`
- Purpose: 给产品、运营、导演、writer room、实施 agent 看

### Human-readable checklist

- Path: `docs/project/overview/kickoff-planning-review-checklist.md`
- Purpose: 给 planning review / pre-import 评审使用

### Human-readable blueprint

- Path: `docs/project/overview/kickoff-orchestration-blueprint.md`
- Purpose: 给导演、writer room、visual planning、integrator 和 operator 共享一条流程型 kickoff 主线

### Machine-readable template

- Path: `config/kickoff/planning/orchestration-stage-blueprint.template.v1.yaml`
- Purpose: 给后续 kickoff pack 生成器、planning lint、pre-import review 和自动化编排读取

### Machine-readable draft

- Path: `config/kickoff/planning/requirements.v1.yaml`
- Purpose: 给后续 lint / import preflight / planning review 接线

## Invariants

- 不得把 planning requirement 误写成 runtime import schema。
- 不得把 kickoff blueprint 误写成“完整剧本”；它必须是一份 orchestration flow。
- 不得要求每条 kickoff 都引用具体人物名。
- 不得让 kickoff 规模退化成 readiness floor 的最小满足。
- 不得要求首轮 kickoff 完结所有主线。

## Source Contracts

- `config/kickoff/manifest.v1.yaml`
- `config/kickoff/quality/acceptance.v1.yaml`
- `config/launch/launch_community_rules.v1.yaml`
- `config/launch/system_roster.launch.v1.yaml`
- `docs/project/overview/LLM_forum_DevSpec.md`

## Downstream Consumers

- 后续 kickoff authoring patch 生成器
- planning review checklist
- orchestration blueprint 作者与执行者
- 未来的 kickoff lint / preflight
- 人类导演 / writer room / visual planning 流程
- 机器可读 kickoff orchestration pack 生成器
