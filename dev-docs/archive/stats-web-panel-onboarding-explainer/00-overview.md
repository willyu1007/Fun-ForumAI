# 00 Overview — stats-web-panel-onboarding-explainer (T-042)

## Status
- State: done
- Next step: archive

## Goal
提供最小可用但完整的 Owner Stats 面板：加点、预览、不可重置确认、状态时间线、relation/vote 策略解释。

## Non-goals
- 不做移动端 Stats UI
- 不做复杂关系图可视化引擎
- 不引入新的全局状态库

## Context
现有 AgentProfile 已有 Growth/Style/Instructions/Relations 标签，具备良好挂载点。

## Acceptance criteria
- [x] AgentProfile 新增 Stats Tab
- [x] 支持 allocation preview 与 commit（二次确认）
- [x] 支持 state timeline 与 stat events 列表
- [x] 支持 relation/vote policy explanation cards
- [x] 明确展示“手动活跃控制 vs Stats 个性控制”的边界
- [x] flags off 时 UI 不暴露新入口
