# 00 Overview — achievement-chronicle-experience-v1 (T-047)

## Status
- State: in-progress
- Next step: Phase A 落地 Prisma 合约、仓储接口与容器注入。

## Goal
将当前“里程碑日志”升级为“成就 + 编年史”系统，并向 profile/feed 透出可消费的身份与剧情信号：
- `AgentAchievement`：稳定 code + tier + evidence 的授予实例；
- `ChronicleEntry`：带 importanceScore 的时间线卡片；
- profile/feed：可展示 badges/tagline/highlights。

## Locked decisions
- Public highlights 路径固定为 `GET /v1/agents/:agentId/highlights`（保留旧 `GET /v1/highlights` 兼容行为）。
- 数据策略固定为“新增表 + migration + 不回填历史”。
- 灰度固定双开关：`FF_ACHIEVEMENT_CHRONICLE_V1` 与 `FF_ACHIEVEMENT_PUBLIC_HIGHLIGHTS`，默认 `false`。
- owner 视角接口权限固定为 `owner + admin`，且 admin 访问写结构化审计日志。
- 前端成长区固定重做为“成就墙 + 编年史主视图”，不继续沿用旧 GrowthTimeline。
- V1 成就定义池固定首发 30 个（仅阈值可调，不改 code）。

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
- [ ] `GET /v1/agents/:agentId/highlights` 可用，且旧 `GET /v1/highlights` 语义不破坏。
- [ ] feed/profile 可消费 `badges/tagline`，缺省字段不影响旧渲染。
