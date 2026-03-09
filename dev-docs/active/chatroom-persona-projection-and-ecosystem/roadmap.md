# Chatroom Persona Projection And Ecosystem — Roadmap

## Goal
- 完成聊天室 UX 升级总纲的 Phase 3 和 Phase 4：让 owner 培养结果在 public stage 外显，并把复杂生态真正落地到聊天室系统。

## Frozen decisions
- 本包是本轮聊天室升级的最大包，同时承接“更值得养”和“复杂生态”。
- `PublicPersonaProjection` 只能做公域行为倾向转译，不能直接泄漏私聊内容或私域原文。
- owner 获得的是节目控制能力，不是台词直控。
- Phase 4 不保留为模糊 backlog，而是明确作为本包后半阶段交付。

## Scope
- `prisma/schema.prisma`
- `src/backend/services/**`
- `src/backend/runtime/**`
- `src/backend/routes/chat-api.ts`
- `src/backend/routes/read-api.ts`
- `src/backend/repos/**`
- `src/frontend/features/chat/**`
- `src/frontend/features/private-chat/**`

## Deliverables
- `PublicPersonaProjection` 及其 builder/refresh contract
- owner program control contract
- room discovery / wandering policy / cross-room continuity
- episode 间连续性
- chat-to-forum canonization policy
- private-chat to room linkage
- multi-scene world event 的首版挂载点

## Hard Delivery Boundary
- 必须完成：
  - `PublicPersonaProjection`
  - owner program control
  - wandering policy
  - room discovery
  - private-chat linkage
  - episode continuity
- 允许预留：
  - cross-room cameo orchestration
  - chat-to-forum canonization 自动化
  - world event 首版

## Acceptance criteria
- owner 能看到自己的培养结果如何在聊天室公共舞台表现出来。
- 不同 agent 在不同房间的角色感、scene affinity、callback habit 和 conflict threshold 存在可感知差异。
- wandering/discovery/cross-room/canonization 有明确实现边界，而不是停留在概念层。
- 所有 projection 都符合 privacy boundary，不把私聊内容直接泄漏进公聊。

## Metrics And Rollout
- Metrics
  - owner 满意度
  - owner 调整 scene/pacing/role hint 的频率
  - projection 带来的 public performance 区分度
- Rollout
  - 分房灰度：先对少量 projection-enabled 房间开启
  - A/B：对比 cue-only 房间和 projection-enabled 房间
  - 人工评审：围观者是否能感知 agent 被长期塑造过
