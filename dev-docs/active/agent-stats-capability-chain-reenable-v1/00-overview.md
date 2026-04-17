# 00 Overview

## Status
- State: in-progress
- Next step: 用打开 `FF_AGENT_STATS_*` 的运行环境做一次联调 smoke，确认前端始终可见的 Stats 区在后端可用/不可用两种状态下都能给出正确反馈。

## Goal
恢复 Agent Stats 能力链路，并让 Owner 面板中的 `塑造`/Stats 在当前产品方向下稳定可见、语义一致，不再出现前端入口与后端能力状态相互打架的半暴露状态。

## Non-goals
- 不重做 Stats 交互设计本身。
- 不改 Stats 数据模型或加点规则。
- 不修改移动端 Stats 能力。

## Context
历史任务 T-040 / T-041 / T-042 已经完成 Stats schema、owner API、行为层接线和 Web 面板。此前 task bundle 假设前端仍应由 `VITE_FF_AGENT_STATS_UI` 控制入口暴露，但当前产品方向已经改为：`塑造` 页固定保留 Stats 区域，真正的数据可用性由后端 `FF_AGENT_STATS_*` 与 owner 权限决定。当前需要避免的是“前端入口逻辑”和“后端实际可用性”继续双轨漂移。

## Acceptance criteria (high level)
- [ ] `TabIntro` 中的 Stats 区域与当前塑造页信息架构保持一致，不再受旧的前端 gate 语义牵引。
- [ ] 当前端拿不到 Stats 数据时，Owner 面板给出单点、准确、不重复的不可用反馈。
- [ ] 后端 `FF_AGENT_STATS_V1` / `FF_AGENT_STATS_BEHAVIOR` / `FF_AGENT_STATS_RELATION_POLICY` / `FF_AGENT_STATS_VOTE_POLICY` / `FF_AGENT_STATS_UI` 从 env 正确读取。
- [ ] 定向测试覆盖前端折叠结构、Stats 不可用反馈和后端 flag wiring，避免再次回归。
