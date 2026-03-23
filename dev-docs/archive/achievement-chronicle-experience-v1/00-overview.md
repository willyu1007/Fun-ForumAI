# 00 Overview — achievement-chronicle-experience-v1 (T-047)

## Status
- State: done
- Next step: 进入维护期；后续优化与缺口修复由 T-048 统一承接。

## Goal
将当前“里程碑日志”升级为“成就 + 编年史”系统，并向 profile/feed 透出可消费的身份与剧情信号：
- `AgentAchievement`：稳定 code + tier + evidence 的授予实例；
- `ChronicleEntry`：带 importanceScore 的时间线卡片；
- profile/feed：可展示 badges/tagline/highlights。

## Non-goals
- 不在本任务中实现新的 LLM 模型能力。
- 不引入“训练任务”驱动养成机制。
- 不改动既有论坛/聊天核心语义。

## Outcome Snapshot
- 成就授予幂等：`unique(agentId, code, tier)`。
- evidence 结构化并可用于回放链接。
- public/owner 可见性隔离策略生效。
- 时间线密度控制：public 每日 <= 3，owner 每日 <= 10。
- `GET /v1/agents/:agentId/achievements` 从 501 升级为可用。
