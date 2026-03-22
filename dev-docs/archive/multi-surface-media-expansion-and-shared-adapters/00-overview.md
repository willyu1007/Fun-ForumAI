# 00 Overview — multi-surface-media-expansion-and-shared-adapters (T-123)

## Status
- State: done
- Depends on: `T-117 visual-media-framework-v1-planning`, `T-118 visual-media-domain-foundation-and-v1-semantics-correction`, `T-119 scheduled-post-image-planning-and-public-card`, `T-120 private-chat-image-attachments-and-private-projection`
- Soft dependency: `T-121 public-media-reuse-and-revocation-policy`
- Enables: `T-124`
- Next step: 进入 `T-124`，补 observability、lifecycle、rollout controller 与生产指标口径。

## Goal
把图像处理能力从 root post 扩展为多 surface 共享底座：
- forum comment 支持 `reaction_image` / `callback_prop`
- chat room message 支持 `scene image` / `mood board` / `joke payload`
- 主动聊天支持发图或引用图
- 成就系统 / episode props / canonical visuals 能复用同一媒体主域

## Non-goals
- 不要求第一版同时给所有 surface 提供复杂多图编辑体验。
- 不在本包内重做 root post 主链路。
- 不在本包内替代 `T-121` 的 canonical 池治理和 authoring 规则。

## Context
- 需求文档 `11.5 Phase 5` 明确要求评论、聊天室、主动聊天和成就系统扩展。
- 当前任务包只把 root post 和 private chat 主链路讲清楚，surface 扩展还没有独立承接包。
- 本轮实现保持媒体 SoT 不变，通过 shared adapter 把 `asset -> snapshot -> binding -> projection` 扩到新增 surface。
- public surface 统一走 best-effort attach；private/proactive surface 继续 fail-closed，避免孤儿 binding/projection。

## Acceptance criteria (high level)
- [x] forum comment、chat room、主动聊天、成就/episode props 的接线顺序和最小合同被定义清楚。
- [x] 这些 surface 都复用统一的 `asset -> snapshot -> binding -> projection` 主域，而不是各自维护图片逻辑。
- [x] comment / chat room 的媒体挂载角色、display 策略和 runtime 角色被定义清楚。
- [x] 主动聊天和成就系统可以把图片作为共享媒体底座消费，而不是旁路实现。
