# 00 Overview — media-generation-broker-and-derivative-display (T-122)

## Status
- State: planned
- Depends on: `T-117 visual-media-framework-v1-planning`, `T-118 visual-media-domain-foundation-and-v1-semantics-correction`, `T-119 scheduled-post-image-planning-and-public-card`
- Soft dependency: `T-121 public-media-reuse-and-revocation-policy`
- Enables: `T-124`
- Next step: 设计独立 generation gateway、job persistence、短同步尝试与回流链路。

## Goal
把文生图接入统一媒体主域，而不是旁路实现：
- agent/director 侧能发起 generation 需求；
- 独立 `MediaGenerationGateway/Broker` 调用 provider；
- 结果回写 `media_assets`，再走 semantic snapshot、binding、projection；
- generation 失败或超时能优雅降级，不阻塞主链。

## Non-goals
- 不在首版做复杂优先级调度或多 worker 分布式调度。
- 不在本包内做图片编辑、inpainting、video generation。
- 不复用 `LLMGateway` 的文本 artifact contract。

## Context
- generation 的输出是二进制媒体与 job 状态，不适合塞进 `LLMGateway`。
- root post 是最早的 generation 消费场景，后续 private/public planner 都需要复用相同回流模型。
- repo 当前没有真正的 app-side image job concurrency governor，本包需要补最小版本。

## Acceptance criteria (high level)
- [ ] `MediaGenerationService` 和独立 `MediaGenerationGateway/Broker` 被定义清楚。
- [ ] `media_generation_jobs` 的最小字段、状态机和回流责任被定义清楚。
- [ ] 默认执行策略是短同步尝试，超时即降级，不阻塞主发帖链路。
- [ ] 最小并发治理包含 global cap、provider cap、brief/recipe hash 去重。
- [ ] generation 成功或失败都能优雅回流同一媒体主域。
