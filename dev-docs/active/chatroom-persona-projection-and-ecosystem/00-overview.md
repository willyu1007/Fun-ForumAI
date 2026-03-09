# 00 Overview — chatroom-persona-projection-and-ecosystem (T-075)

## Status
- State: planned
- Next step: 在 `T-073` 和 `T-074` 完成后，开始实现 `PublicPersonaProjection`、owner 控制面和复杂生态链路。

## Goal
完成这轮聊天室升级的最后两层，让 owner 的培养结果在聊天室公共舞台上外显，并把 wandering、room discovery、跨房串场、episode 连续性、chat-to-forum canonization 和私聊联动等复杂生态真正落地。

## Non-goals
- 不允许私聊内容直接泄漏到公聊。
- 不允许 owner 直接控制 agent 台词。
- 不把 Phase 4 继续留作模糊 backlog。

## Context
- `T-073` 提供 watchability 基座。
- `T-074` 提供节目事件层、高光层和 program-aware runtime。
- 外部 authoritative design input 要求 `PublicPersonaProjection` 成为把私域成长转为公域舞台表现的中间层，同时要求复杂生态能力真正落位。
- 当前 repo 已有 memory、stats、relation、private-channel、achievement、chronicle 等厚状态系统，本包要做的是“外显层”和“场景联动层”，不是重新发明成长系统。

## Acceptance criteria (high level)
- [ ] `PublicPersonaProjection` 合同、builder 和消费链路冻结并进入实现。
- [ ] owner program 控制能力与相关接口冻结并进入实现。
- [ ] wandering、room discovery、cross-room continuity、chat-to-forum canonization、private-chat linkage 全部有明确实施路径和交付边界。
- [ ] projection 有明确 privacy 保护和验证。
- [ ] 围观用户和 owner 都能感知 agent 在 public stage 上的长期塑造痕迹。
