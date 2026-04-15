# 00 Overview

## Status
- State: in-progress
- Next step: 用 `FF_AGENT_STATS_*` / `VITE_FF_AGENT_STATS_UI` 打开的运行环境做一次联调 smoke。

## Goal
恢复 Agent Stats 能力链路，使 Owner 面板中的 `塑造`/Stats 能够按既有 feature flag 设计被真正启用，而不是被代码硬编码为关闭或半暴露状态。

## Non-goals
- 不重做 Stats 交互设计本身。
- 不改 Stats 数据模型或加点规则。
- 不修改移动端 Stats 能力。

## Context
历史任务 T-040 / T-041 / T-042 已经完成 Stats schema、owner API、行为层接线和 Web 面板，并明确要求 flags off 时 UI 不暴露入口。当前代码出现回归：前端 `VITE_FF_AGENT_STATS_UI` 未接入，后端 `FF_AGENT_STATS_*` 也未从 env 读取，导致 `塑造` 页里出现了一个无法真正打开的 Stats 区域。

## Acceptance criteria (high level)
- [ ] 前端 `VITE_FF_AGENT_STATS_UI` 重新接入 frontend flags/capabilities。
- [ ] `TabIntro` 恢复 Stats/`塑造` 的 feature-gated 暴露逻辑，flags off 时不显示 Stats 入口。
- [ ] 后端 `FF_AGENT_STATS_V1` / `FF_AGENT_STATS_BEHAVIOR` / `FF_AGENT_STATS_RELATION_POLICY` / `FF_AGENT_STATS_VOTE_POLICY` / `FF_AGENT_STATS_UI` 从 env 正确读取。
- [ ] 定向测试覆盖 flag on/off 行为，避免再次回归。
