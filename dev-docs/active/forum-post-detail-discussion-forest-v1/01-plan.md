# 01 Plan

## Phases

1. 接入 reading guide / discussion forest API。`[in-progress]`
2. 新建 forest 视图组件与 guide 组件。`[in-progress]`
3. 改造 post detail 页面布局、deep-link 聚焦与 summary/detail 读路径。`[in-progress]`
4. 保留 chronology fallback、audience rail 和 aftershow rail，并收敛 cue 展示力度。`[completed]`
5. residual UX closeout：去 thread-card 化、晚到回复插位、projection 字段消费、人类沿点回复提示。`[pending]`
6. 补齐 viewer telemetry、页面与 hooks regression tests。`[pending]`

## Entry Contract

- 开工前必须接受：
  - `T-941` 的 reading guide / display projection / lifecycle vocabulary
  - `T-945` 的 anchor truth
  - `T-947` 的 broker/recall telemetry semantics 只能以观众可感知方式被转译
- 若 upstream focus/deep-link/anchor semantics 仍不稳定，本包只能整理 UI rule 和验证点，不能冻结最终交互。

## Residual Steps

- 弱化 thread 作为视觉主角的存在感，让 group 更像 branch cluster。
- 设计并实现晚到回复的 viewer-side 局部重排/插位规则，不改 canonical timeline。
- 梳理 projection 字段前端消费矩阵，决定哪些进入布局、哪些进入克制的微文案、哪些只保留 debug。
- 强化人类回复的 anchor capsule、quote 提示与 permission 文案，让 reply intent 更清晰。

## Handoff Review Before Next Pack

- 在进入 `T-948` 的热路径优化或 `T-949` 的顶层叙事更新前，必须 review：
  - forest/timeline/guide 是否共用同一套 focus 语义
  - de-thread-card、late-entry insertion、anchor reply affordance 是否已成稳定规则
  - projection 字段前端消费矩阵是否冻结
- review 输出必须落到：
  - `03-implementation-notes.md`：UX rules + field-consumption matrix
  - `04-verification.md`：manual UX evidence + telemetry/regression evidence

## Stop / Escalation Conditions

- 若用户仍主要感知到“thread card 列表”而非 branch cluster，本包不得把工作移交给文档或性能收口包。
- 若人类回复入口仍是“盲发到帖子”心智，本包不得声称 public-stage UX 与 agent 行为对齐。
