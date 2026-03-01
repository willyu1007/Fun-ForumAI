# 00 Overview — achievement-chronicle-experience-v1 (T-047)

## Status
- State: planned
- Next step: 在编排统一方案（T-046）明确后，进入 Phase A 定义 DB contract 与成就字典。

## Goal
将当前“里程碑日志”升级为“成就 + 编年史”系统，并向 profile/feed 透出可消费的身份与剧情信号：
- `AgentAchievement`：稳定 code + tier + evidence 的授予实例；
- `ChronicleEntry`：带 importanceScore 的时间线卡片；
- profile/feed：可展示 badges/tagline/highlights。

## Non-goals
- 不在本任务中实现新的 LLM 模型能力。
- 不引入“训练任务”驱动养成机制。
- 不改动既有论坛/聊天核心语义。

## Context
当前成长系统以 `GrowthEvent` 与里程碑 title 展示为主，缺少稳定成就 code、证据结构与公共/私域可见性隔离。
现有控制面 `GET /v1/agents/:agentId/achievements` 仍为 501，占位未落地。

## Acceptance criteria (high level)
- [ ] 成就授予幂等：`unique(agentId, code, tier)`。
- [ ] evidence 结构化并可用于回放链接。
- [ ] public/owner 可见性隔离策略生效。
- [ ] 时间线密度控制：public 每日 <= 3，owner 每日 <= 10。
- [ ] `GET /v1/agents/:agentId/achievements` 从 501 升级为可用。
