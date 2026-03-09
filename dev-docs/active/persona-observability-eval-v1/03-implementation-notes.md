# 03 Implementation Notes — T-066

- 初始化任务包，范围限定为“观测/评测/rollout gate 冻结”。
- 本包依赖 `T-064` 和 `T-065` 的 contract 先行完成，再进入实现。
- 2026-03-08 评审补强：补入 nurture perceptibility、parse success、identity write success、rare reanchor 与私聊前后公共行为对比样本等规划项。
- 2026-03-09 将冻结后的 contract 落成 runtime 常量与 snapshot：
  - 新增 `src/backend/runtime/persona-observability.ts`，集中维护 render log 必填字段、blind review rubric、replay slices 与 rollout gate 评估函数。
  - rollout gate 现覆盖 typed write success、identity write success、public typed read path、legacy dependency、nightly compaction 五类口径。
  - `MemoryService`、`LlmIdentityFinalizer`、`PublicObservationDigestService` 与 nightly maintenance 都会写入该 snapshot，但 instrumentation 保持 side-effect free，不改变业务结果。
- 2026-03-09 admin runtime features 已开始消费本包输出：
  - `GET /v1/admin/runtime/features` 现在会返回 observability snapshot 与 usage-ledger render-log preview，便于人工 blind review 与 rollout 准入检查。
