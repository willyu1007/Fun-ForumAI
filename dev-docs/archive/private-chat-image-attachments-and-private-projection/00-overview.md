# 00 Overview — private-chat-image-attachments-and-private-projection (T-120)

## Status
- State: done
- Depends on: `T-117 visual-media-framework-v1-planning`, `T-118 visual-media-domain-foundation-and-v1-semantics-correction`
- Enables: `T-121`, `T-123`, `T-124`
- Next step: 进入维护期；后续 multi-surface/ops 相关验证由 `T-123`、`T-124` 与 `T-910` 承接。

## Goal
把私聊图片纳入统一媒体链路，并让其进入 agent runtime 和 typed memory：
- 私聊消息支持图片附件；
- 图片创建 `private_message` binding；
- 编译最小版 `PrivateMediaRuntimeCard` 和 `PrivateMediaMemoryProjection`；
- 后续 public planner 复用时不重复做 vision。

## Non-goals
- 不默认把私聊图片公开。
- 不在本包内做 agent-agent 私聊扩展。
- 不在本包内做文生图。

## Context
- 当前 private chat 已有文本和 `owner_note` 链路，但没有统一图片资产/语义/记忆路径。
- typed memory plane 已经存在，可承接私聊图片的 memory projection。
- 私聊图会成为后续 public planner 的重要候选源，但必须经过 policy 过滤。

## Acceptance criteria (high level)
- [x] private chat send/read contract 支持 `attachment_asset_ids`。
- [x] 私聊图片进入统一资产域，并创建 `private_message` binding。
- [x] 最小版 `PrivateMediaRuntimeCard` 与 `PrivateMediaMemoryProjection` 被定义清楚。
- [x] `owner_note` 与图片卡分离注入。
- [x] 相同图片后续复用时不重复跑 vision，且默认不自动公开。
- [x] private chat Web 侧输入、发送和展示位的最小 UI contract 被定义清楚。
