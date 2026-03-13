# 01 Plan — T-089

## Phase 0 Rebaseline And Governance Freeze
1. 把 `T-089` 从“最小闭环已落”重定为“case-centered full foundation”，同步任务包、母包和 `registry.yaml` 语义。
2. 固定边界：`T-089` 只负责 case/review/task/action-log/complaint/appeal/delete/privacy foundation；provenance/config 留在 `T-090`，hot-topic/transparency/kill switch 留在 `T-091`。
3. 固定领域约束：open-case uniqueness、complaint-driven reopen、appeal reversal、delete/privacy request 先 case 化、所有人工/系统动作强制写 action log。

## Phase 1 Domain Contract Upgrade
1. 扩展 `ModerationCase`：queue、风险摘要、对象主键对、SLA/claim/resolution 元数据、linked complaint/appeal/delete refs。
2. 扩展 `ModerationCaseTarget`：`relation_type`、`meta_json`，支持 `primary/related/parent_thread/session_member/owner/agent`。
3. 将 `ModerationEvidenceSnapshot` 从 `snapshot_type + payload` 升级为结构化 evidence contract，至少覆盖原文、上下文、策略命中、prompt/memory、topic 证据。
4. 扩展 `ReviewTask`：queue、claim/lock、assigned role、`due_at`、resolution/operator note。
5. 将 `ComplaintTicket` / `AppealRequest` 升级为 typed object，纳入 privacy/deletion/impersonation/mislabel；保留 `/v1/reports`、`/v1/appeals` 作为兼容 facade。

## Phase 2 Workflow Services
1. 将 `ReviewService` 目标合同收敛为 `ensureCase`、`claimTask`、`resolveCase`，由 service 负责 case 复用、task 生命周期和 action log。
2. 将 `ComplaintAppealService` 目标合同收敛为 `createComplaint`、`createAppeal`，投诉、申诉、删除请求均不得直接改内容状态。
3. 保持 `T-088` 的 policy/risk evidence 作为上游输入，不反向改写 channel enforcement；只负责接收自动 case、复用/reopen、挂接 complaint/appeal/delete/privacy 流。

## Phase 3 Operator And User Surfaces
1. 管理台补队列分类、claim/assign/transfer/reopen/resolve、complaint/appeal panel、case detail tabs、evidence export。
2. 用户面补齐 post/comment/chat/private/proactive 举报入口、Safety Center 状态时间线、治理状态变更通知。
3. 兼容现有 `/v1/reports`、`/v1/appeals` 和最小 queue/case 页面，新增 typed workflow 时保持渐进迁移。

## Phase 4 Verification
1. 验证文档、母包和 registry 对 `R-051/T-089` 的语义一致。
2. 为 open-case uniqueness、complaint-driven reopen、appeal reversal、delete/privacy request case 化、action log 强制落库补验证矩阵。
3. 验证边界回归：不得把 provenance/config 逻辑吸回 `T-089`，也不得把 hot-topic/kill switch 需求塞进 `T-089`。

## Completion checkpoint — 2026-03-12
- Phase 0~4 已完成：rebaseline、领域合同、workflow service、operator/user surface 与 verification 全部落地。
- `T-089` 现已退出“baseline only”状态，成为 launch track 可复用的 shared foundation。
- 若后续需要 bulk action、批量导出编排或更复杂的值班策略，应从已完成的 foundation 上另拆 follow-up，而不是重新打开 `T-089` 边界。
