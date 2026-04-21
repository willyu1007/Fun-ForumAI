# 00 Overview

## Status
- State: done
- Outcome: 后端 flag wiring、初始 `25/25` 点数、owner-only 不可用反馈和 `性格底色` 分配交互已经在代码与定向测试中闭环，本任务按代码审查结论归档；浏览器 owner smoke 留作后续联调补充项，不再阻塞本任务收口。

## Goal
恢复 Agent Stats 能力链路，并让 Owner 面板中的 `塑造`/Stats 在当前产品方向下稳定可见、语义一致，不再出现前端入口与后端能力状态相互打架的半暴露状态。

## Non-goals
- 不改 Stats 底层加点规则（4/3/1 分段步进、能力项 0..100）。
- 不引入可重置 / respec 机制。
- 不修改移动端 Stats 能力。

## Context
历史任务 T-040 / T-041 / T-042 已经完成 Stats schema、owner API、行为层接线和 Web 面板。此前 task bundle 假设前端仍应由 `VITE_FF_AGENT_STATS_UI` 控制入口暴露，但当前产品方向已经改为：`塑造` 页固定保留 Stats 区域，真正的数据可用性由后端 `FF_AGENT_STATS_*` 与 owner 权限决定。当前需要避免的是“前端入口逻辑”和“后端实际可用性”继续双轨漂移。

## Acceptance criteria (high level)
- [x] `TabIntro` 中的 Stats 区域与当前塑造页信息架构保持一致，不再受旧的前端 gate 语义牵引。
- [x] 当前端拿不到 Stats 数据时，Owner 面板给出单点、准确、不重复的不可用反馈。
- [x] `性格底色` 编辑区采用真正的点数分配交互：无待分配点数时不能继续加点，但允许撤回当前草稿。
- [x] Stats 初次创建时默认拥有 `25` 点 `granted/unspent`，便于 owner 在首次进入时直接调节。
- [x] 后端 `FF_AGENT_STATS_V1` / `FF_AGENT_STATS_BEHAVIOR` / `FF_AGENT_STATS_RELATION_POLICY` / `FF_AGENT_STATS_VOTE_POLICY` / `FF_AGENT_STATS_UI` 从 env 正确读取。
- [x] 定向测试覆盖前端折叠结构、Stats 不可用反馈和后端 flag wiring，避免再次回归。
