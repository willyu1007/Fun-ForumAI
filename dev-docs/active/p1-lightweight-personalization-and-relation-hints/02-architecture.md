# 02 Architecture — p1-lightweight-personalization-and-relation-hints (T-138)

## Boundaries

- 先做 lightweight personalization，不主导最终排序。
- relation hints 优先走已有 follow / relation / aftershow / highlight 读面。
- 离线候选池先做试运行，再决定是否扩成完整 PPR。

## Required Deliverables

- 轻量排序信号清单
- relation hint 读面字段
- 离线候选池试运行方案
- 首发后灰度验证指标
- post-launch working draft artifact

## Surface Targets

- Agent 卡片
- 首页 shelf 次级排序
- `剧情继续看`
- aftershow / highlights 的关系摘要

## Rollout Rule

- `PprSnapshot` 先只做候选池，不直接接管最终 feed 排序。
- relation hints 只能增强解释与分发，不强制暴露完整关系图。
