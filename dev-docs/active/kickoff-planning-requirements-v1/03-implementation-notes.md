# 03 Implementation Notes — kickoff-planning-requirements-v1 (T-968)

## 2026-04-15 — task bootstrap

- 决策：不复用已完成的 `T-964`，单独建立 `T-968` 承接项目级 kickoff planning requirement。
- 原因：`T-964` 主要解决 kickoff workflow、bootstrap、import、readiness 与 local tooling；当前缺口是“内容规划 contract”，边界不同。
- 初始约束已冻结：
  - kickoff 目标从 `readiness floor` 提升到 `planning target`
  - 总量目标改为 `40-45` 条 root posts
  - 每社区目标改为 `3-4` 条 root posts
  - 禁止凭空引入非 roster / 非 canon 专有角色名
  - 首轮 kickoff 不得直接收口

## 2026-04-15 — first draft landed

- 新增项目级规则文档：`docs/project/overview/kickoff-planning-requirements.md`
- 新增机器可读草案：`config/kickoff/planning/requirements.v1.yaml`
- 新增 planning task bundle：`dev-docs/active/kickoff-planning-requirements-v1/`
- 文档结构采用两层：
  - 人类规则：目的、边界、MUST/SHOULD/MAY、review gate、verification
  - 机器可读规则：volume / topic_sourcing / cast_boundary / unresolved_loops / visual_planning / review_gate
- 顺手修正了一处 kickoff 历史治理漂移：
  - `T-964` 的状态值从无效的 `completed` 收敛到治理合同接受的 `done`

## 2026-04-15 — checklist and blueprint correction

- 新增独立 checklist：`docs/project/overview/kickoff-planning-review-checklist.md`
- requirement 文档与 YAML 草案同步补充了 blueprint 形式约束：
  - kickoff blueprint 必须是 orchestration flow
  - 必须显式写出 stage / trigger / owner / inputs / outputs / handoff
  - 不允许把 kickoff 蓝图写成同日完结的完整剧本
- 这次调整仍然只作用于 planning contract，不修改 runtime import / bootstrap 代码

## 2026-04-15 — orchestration blueprint landed

- 新增项目级蓝图文档：`docs/project/overview/kickoff-orchestration-blueprint.md`
- 蓝图不再描述“14/40 条具体剧情内容”，而是描述一轮 kickoff 的编排流程：
  - preconditions
  - topic intake
  - opportunity scan
  - director framing
  - planning review A
  - writer generation
  - visual planning
  - image generation or selection
  - planning review B
  - import assembly
  - candidate import and observe
  - runtime top-up trigger
- 这份蓝图还显式把图片问题纳入流程边界：
  - 图片不达标时先回到 `generation/select -> visual planning`
  - 禁止默认降级为社区 banner

## 2026-04-15 — machine-readable stage blueprint template landed

- 新增模板：`config/kickoff/planning/orchestration-stage-blueprint.template.v1.yaml`
- 模板内容和文字蓝图保持一一对应：
  - contract refs
  - blueprint defaults
  - required artifacts
  - stage templates
  - review gate templates
  - specialization slots
- 这份模板的定位是“复制并 specialize 成具体 kickoff orchestration pack”，不是直接作为 runtime import schema 使用
- 模板当前解析结果：
  - `template_id = kickoff-orchestration-stage-blueprint`
  - `stage_templates = 12`
