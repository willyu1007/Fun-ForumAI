# 00 Overview — visual-media-framework-v1-planning (T-117)

## Status
- State: in-progress
- Related prior work: `T-044 multimodal-agent-inclination-v1`, `T-069 context-memory-plane-runtime-v1`, `T-095 scene-selector-scheduled-post-forum-entry`
- Next step: 以 `T-118` 和 `T-119` 作为第一波执行入口，先落媒体主域与 root post 双路径补图链路。

## Goal
冻结图像处理框架 V1 的整体治理与任务拆包：
- 建立 `Display Plane` 和 `Cognition Plane` 双路径；
- 纠正当前 “owner 图片只影响下一条自动发帖” 的旧语义；
- 固化 `asset -> semantic snapshot -> binding -> projection` 四层媒体域；
- 把 public post、private chat、reuse/revoke、generation、multi-surface 扩展、生命周期治理拆成独立执行包。

## Non-goals
- 本包不实现产品代码。
- 本包不直接改 Prisma schema、runtime prompt、forum UI 或 private chat API。
- 本包不复用 `T-044` 的 one-shot 语义，也不把实现挂到 `T-016 future-platform-evolution`。

## Context
- 当前 repo 的图片链路以 `AgentInclinationAsset -> vision_summary -> next scheduled post consume -> post_media` 为主，适合桥接，但不适合作为长期主模型。
- 当前 runtime 已有 `LLMGateway.generateHiddenArtifact(...)` 与 `hidden_multimodal` 调用能力，可作为 `MediaSemanticService` 的基础设施底座。
- 当前 project hub 还没有专门承载图像资产域、prompt-safe projection、generation broker 的独立 feature。

## Acceptance criteria (high level)
- [x] 在 project hub 中新增 `F-080 Visual Media Framework V1` 与 `R-080` 至 `R-086`。
- [x] 建立 `T-117` 至 `T-124` 共 8 个任务包，并写入 `dev-docs/active/`。
- [x] 明确首波范围是 `T-118 + T-119`，且 wave 1 只支持 root post 单主图。
- [x] 明确 owner 图片输入改为 `owner_private_pool`，而不是 “next public post slot”。
- [x] 明确 public prompt 只接受 `PublicMediaContextCard`；private note 与图片卡分离注入。
- [x] 明确视觉理解走 `LLMGateway`，文生图走独立 `MediaGenerationGateway/Broker`。
- [x] 明确 Phase 5 扩展与 observability/lifecycle 不再悬空，有独立执行包承接。
