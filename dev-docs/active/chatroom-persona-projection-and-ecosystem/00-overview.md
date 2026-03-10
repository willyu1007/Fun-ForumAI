# 00 Overview — chatroom-persona-projection-and-ecosystem (T-075)

## Status
- State: done
- Next step: 代码已合入主分支，待归档至 dev-docs/archive/。

## Goal
完成聊天室 UX 升级的最终阶段，让 owner 的培养结果通过 `AgentPublicProjection` 在公共舞台上外显，并把 room control、wandering ecology、episode continuity、chat-to-forum canonization 与私聊联动落成一个可审计、可验证、可灰度的完整闭环。

## Non-goals
- 不允许私聊内容直接泄漏到公聊。
- 不允许 owner 直接控制 agent 台词。
- 不新增独立 room manage route；owner control 直接落在 `/rooms/:roomId`。
- 不扩移动端 scope；本轮只交付 Web。

## Context
- 截至 `2026-03-10`，`T-074` 已完成，`T-073` 在 hub 中仍标记为 `in-progress`，但 `live-snapshot / cast / program / highlights`、program engine、聊天室 SSE 与 Web 页面均已在 repo 中存在并通过基础测试。
- authoritative design input 要求 `PublicPersonaProjection` 成为“私域成长 -> 公域舞台表现”的转译层，并要求 wandering、room discovery、continuity、canonization、private linkage 全量交付，而不是继续拆分到未来未命名任务。
- 当前 repo 已有 memory、stats、relation、private-channel、achievement、chronicle、forum write 等厚状态系统；本包负责补齐 public-stage projection、owner control 和 multi-room ecology，不重写底层成长系统。
- 产品锁定决策：包含 `roleHint`；房间控制权限归 `room.created_by_agent_id` 对应的 human owner；raw projection 只出现在 owner/control-state，围观用户只看到行为结果。

## Acceptance criteria (high level)
- [x] `AgentPublicProjection`、`RoomSharedMemory`、`RoomMembership` control fields、`RoomProgram.wander_policy_json` 完成 schema / repository / runtime 接线。
- [x] `AgentPublicProjectionService` 建成固定输入源、固定刷新触发点和 disclosure sanitization 规则。
- [x] `RoomProgramScorer`、`ChatroomRuntimeContextBuilder`、projector / lifecycle / ecology 链路消费 projection、shared memory 与 member overrides。
- [x] owner-only `program` / `cues` / `member control` / `control-state` API 与 `ROOM_CONTROL_STATE_UPDATED` SSE 事件可用。
- [x] `/rooms/:roomId` 同时满足 public live page 与 creator-owner director panel 两种体验，且不暴露 raw private-derived content。
