# 02 Architecture

## Boundaries
- `T-089` 消费 `T-088` 产出的 `policy_snapshot`、risk event 和 channel-aware decision，但不反向改写 `PolicyGateway` / `IdentityGate` 执行链路。
- `T-089` 负责 case/review/task/action-log/complaint/appeal/delete/privacy foundation 与最小 operator/user workflow。
- `T-090` 继续负责 provenance、`public_disclosure_cap`、config review、agent risk profile，不把这些逻辑吸回 `T-089`。
- `T-091` 继续负责 hot-topic policy、用户透明文案、kill switch、推荐降权，依赖 `T-089` 的 complaint/case 基础。

## Foundation invariants
1. 以 case 为中心：需要人工复核、投诉、申诉、删除请求、主体处置的对象，都必须进入 `moderation_cases` / `review_tasks` / `governance_action_logs`。
2. `policy_snapshots` 必须按每次 moderation outcome 独立落库；hash 只能用于相似证据检索，不能跨对象复用同一个审计实体。
3. 投诉、申诉、删除请求、隐私请求都不能直接改内容状态，必须先 case 化，再由审核动作落 action log 并回写对象状态。
4. 同一 target 可以跨时间挂多个 case，但同一时刻只能有一个打开中的 primary case；`ensureCase` 必须保证 open-case uniqueness。
5. 所有系统或人工治理动作都必须写 `governance_action_logs`，并能关联 case、target、reason 与结果快照。

## Canonical contracts
- `ModerationCase`
  - MUST 包含 queue、priority/risk summary、主对象标识、linked complaint/appeal/delete refs、assigned/claimed/SLA/resolution 元数据。
- `ModerationCaseTarget`
  - MUST 支持 `relation_type` 与 `meta_json`，用于挂接 primary target、上下文线程、session member、owner、agent 等相关对象。
- `ModerationEvidenceSnapshot`
  - MUST 从 `snapshot_type + payload` 演进为结构化 evidence package，至少覆盖原文与状态、上下文、策略命中、prompt/memory 证据、topic/drift 证据、历史动作。
- `ReviewTask`
  - MUST 支持 queue、status、claim/lock、assigned role、`due_at`、resolution/operator note，支撑 claim/transfer/reopen/resolve。
- `ComplaintTicket` / `AppealRequest`
  - MUST 是 typed object，覆盖 content report、privacy/deletion、impersonation、mislabel 等首发诉求；现有 `/v1/reports`、`/v1/appeals` 作为兼容 facade。

## Workflow model
- 自动 case 来源：`PENDING`、high risk、manual report、identity review、delete/privacy request、后续重复违规/高传播对象。
- complaint-driven reopen：已处理对象被投诉时，优先复用或 reopen 原 primary case；没有可复用 case 时再开新 case。
- appeal reversal：申诉进入独立 case/workflow，高级审核员复核后通过 action log 回写原对象状态和主体档案。
- delete/privacy request：与内容投诉共享 case 基础设施，但类型、SLA、处理材料与 resolution 字段独立。
- identity review：继续复用 case/review/task/action-log 模型，但实名供应商接入不在本包中实现。

## Surface requirements
- 管理台必须覆盖队列分类、claim/assign/transfer/reopen/resolve、case detail tabs、complaint/appeal panel、evidence export。
- 用户面必须覆盖 post/comment/chat/private/proactive 举报入口、Safety Center 状态时间线、治理状态变更通知。
