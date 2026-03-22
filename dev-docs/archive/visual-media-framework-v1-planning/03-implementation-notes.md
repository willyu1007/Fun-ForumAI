# 03 Implementation Notes

- 2026-03-22: 创建 `T-117` 总包与 `T-118` 至 `T-122` 执行包，新增 `F-080` 和 `R-080` 至 `R-084` 的治理映射。
- 2026-03-22: 冻结关键决策：owner 图片进入 `owner_private_pool`；public prompt 只读 `PublicMediaContextCard`；视觉理解复用 `LLMGateway`；generation 走独立 gateway。
- 2026-03-22: 首波执行入口确定为 `T-118 + T-119`，且仅支持 root post 单主图。
- 2026-03-22: 对照系统设计文档补齐缺口，新增 `T-123` multi-surface expansion 与 `T-124` observability/lifecycle/rollout control。
- 2026-03-22: 将 canonical asset authoring 并入 `T-121`，并将迁移/回填、prompt token budget、private chat UI、copyright/origin guardrail 收紧到既有任务包。
- 2026-03-22: 按执行顺序完成任务包 review，给 `T-118` 至 `T-124` 补充合同冻结项、package review gate、downstream handoff criteria 与整体 readiness review。
