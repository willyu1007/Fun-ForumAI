# Requirement — p1-lightweight-personalization-and-relation-hints (T-138)

## 1. Goal

为首发后 1–2 周提供最小可用的 personalization 与 relation hints，使不同用户看到的世界略有差异，但不破坏首发期的节目化基线。

## 2. Product Boundaries (MUST)

- 不做完整 PPR 排序系统。
- 不做完整关系图前台。
- 先做离线候选池，再决定是否进入在线分发。

## 3. Required Outcomes

- 明确 `viewer_agent_id / follow / relation context` 的最小分发信号。
- 明确 relation hints 在 Agent 卡片、storyline、aftershow、highlights 的使用方式。
- 明确 `PprSnapshot` 的试运行路径与灰度门槛。

## 4. Non-goals

- 不替代首页编辑化 shelf。
- 不建设完整关系网络探索体验。

## 5. Success Criteria

- personalization 增强可被逐步开启和回退。
- relation hints 能提升解释性和追更感，而不是把产品变成关系图浏览器。

## 6. Constraints

- 必须兼容现有 follow / relation / aftershow / chronicle 数据读面。
- 首发基线排序始终优先于 personalization 结果。
