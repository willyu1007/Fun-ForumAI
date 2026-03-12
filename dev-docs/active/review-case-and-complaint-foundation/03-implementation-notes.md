# 03 Implementation Notes

## Current status
- 状态：phase-4-complete
- 说明：2026-03-12 已将 `T-089` 从“最小闭环已落”重定为“shared foundation 已定界、按阶段补齐”；同日连续推进七段实现后又追加一段 review-driven hardening，现已完成 typed complaint/appeal foundation、case/review/task queue/claim/SLA/resolution contract、structured evidence contract、admin transfer/release/case detail/evidence export、Safety Center timeline + governance notification 闭环，以及 post/comment/chat/private/proactive 举报入口与 operator/user workflow 收尾，并修复 foundation 级生命周期与锁语义缺口。

## Baseline already in repo
- 已新增 `ReviewService`、`ComplaintAppealService` 与治理仓储。
- `POST/GET /v1/reports`、`POST/GET /v1/appeals` 已可用。
- admin moderation queue / case detail / assign / resolve / reopen / identity review 已接 API 与最小前端。
- governance action log、policy snapshot、evidence snapshot 已持久化。
- review fix：`reports/appeals` 现在只接受 allowlist target type，并在建 ticket/case 前校验 target 是否存在。
- review fix：`ComplaintAppealService.findExistingCaseByTarget()` 改为走治理仓储按 target 直接查 case，修复 200 条窗口之外的重复举报会新开 case 的问题。

## Closure notes
- `ModerationCase` / `ModerationCaseTarget` / `ModerationEvidenceSnapshot` / `ReviewTask` 的 foundation contract 已全部落库并接入 service/operator surface：queue、SLA、claim、resolution metadata、`relation_type`、structured evidence、release/reassign 与 share-safe export 均已闭环。
- `ComplaintTicket` / `AppealRequest` typed workflow 已覆盖 content/privacy/deletion/impersonation/mislabel 等首发诉求，`/v1/reports`、`/v1/appeals` 已退化为兼容 façade。
- admin moderation surface 已完成队列分类、task claim、assign/transfer/release/reopen/resolve、complaint/appeal panel、case detail tabs、queue-specific SOP 与 redacted evidence export。
- user surface 已完成 post/comment/chat/private/proactive 举报入口、Safety Center timeline/workflow copy、governance notification 闭环。
- 仍可能存在的 bulk action、批量导出编排或更复杂值班策略不再算 `T-089` 缺口；若后续需要，应基于当前 foundation 单独拆 follow-up。

## Rebaseline notes
- `policy_snapshots` 不再允许按 hash 跨对象复用审计实体；后续实现只能用 hash 做相似证据检索。
- `T-089` 明确纳入 complaint/appeal/delete/privacy foundation；provenance/config 继续留在 `T-090`，hot-topic/transparency/kill switch 继续留在 `T-091`。

## 2026-03-12 first implementation slice
- Prisma schema 与迁移新增 `ComplaintType`、`AppealType`、`AppealRequesterType`，并为 `complaint_tickets` / `appeal_requests` 增加 `complaint_type`、`attachments_json`、`resolution_json`、`requester_type`、`appeal_type`、`result_json`，把 typed complaint/appeal foundation 先落到持久化层。
- `RiskGovernanceRepository` 的 in-memory / PG 实现同步升级 typed complaint/appeal contract；frontend DTO 与 hooks 同步暴露 `complaint_type`、`appeal_type`、`requester_type`、attachments/result/resolution 字段。
- `ComplaintAppealService` 新增 canonical `createComplaint()` / `createAppeal()`，保留 `createReport()` 作为兼容 façade；加入 `reason_code -> complaint_type` 推断、attachment 归一化、linked complaint 校验与 typed priority 映射。
- `ReviewService` 新增 `ensureCase()`，把 complaint/appeal 收敛到 case-centered reopen/reuse 语义；`assignCase()` / `resolveCase()` / `reopenCase()` 补 actor-aware governance action log。
- `POST /v1/reports`、`POST /v1/appeals` 现在接受 typed 请求字段但继续兼容旧 façade；帖子页举报/申诉入口与 Safety Center 首屏文案同步消费 typed 字段，至少能区分内容举报、隐私请求、删除请求、误标/冒充/骚扰等首发分类。
- 测试新增或补强 `complaint-appeal-service`、`review-service`、`e2e-read-api`、`PostDetailPage`，覆盖 open-case uniqueness、resolved case reopen、typed API response 与 legacy façade 兼容。

## 2026-03-12 second implementation slice
- `ModerationCase` 补齐 `queue`、`risk_summary_json`、`primary_target_type/id`、`sla_due_at`、`claimed_by/claimed_at`、`resolved_by/resolution_note`；`ModerationCaseTarget` 补 `relation_type` / `meta_json`；`ReviewTask` 补 `queue`、`claim_token`、`claimed_by/claimed_at`、`assigned_role`、`resolution_code`、`operator_note`。
- `ReviewService` 现在负责 queue 默认值、SLA 默认值、default task role、`claimTask()`、resolve 时自动完成 outstanding tasks、reopen 时自动创建 follow-up task；`findLatestCaseByTarget()` 也开始只按 `PRIMARY` target 查重，避免未来 related target 误参与 open-case uniqueness。
- `ComplaintAppealService` 开始按 typed complaint/appeal 派发 queue：`PRIVACY_REQUEST -> PRIVACY`、`DELETION_REQUEST -> DELETION`、其他 complaint -> `COMPLAINT`、appeal -> `APPEAL`；`RiskEventService` 打开的自动 moderation case 也开始写 `risk_summary`。
- admin API 新增 `POST /v1/admin/moderation/tasks/:taskId/claim`，`GET /v1/admin/moderation/queue` 支持 `queue` 过滤，`resolve case` 接口开始接收 `resolution_note`。
- admin 前端最小增强：审核队列展示 queue，case detail 展示 `relation_type` 和 task metadata，并允许直接认领 review task。

## 2026-03-12 third implementation slice
- `ModerationEvidenceSnapshot` 持久化层补齐 `content_json`、`context_json`、`policy_hits_json`、`prompt_memory_json`、`topic_signals_json`、`action_history_json`、`evidence_package_json`；in-memory / PG 仓储统一在缺省场景下自动拼装 `evidence_package`，不再只有 `snapshot_type + payload`。
- `RiskEventService` 打开的自动 moderation case 现在总会写入结构化 `policy_evidence`：至少包含原文摘要、channel/target/session 上下文、风险级别/分类/规则命中、以及 decision/action history；`ComplaintAppealService` 的 complaint/appeal evidence 也正式进入同一 contract。
- `ReviewService` 的 identity review、config review、case reopen 路径全部改为落结构化 evidence，确保 complaint-driven reopen、identity request、high-risk config revision 不再留下 payload-only evidence 孤岛。
- admin case detail 开始展示 evidence section badge + JSON preview，至少能直接读到 `content/context/policy_hits/prompt_memory/topic_signals/action_history` 的最小证据面板，为后续 evidence export / case tabs 打基础。
- 测试新增 structured evidence 覆盖：`complaint-appeal-service` 断言 privacy request evidence、`review-service` 断言 reopen evidence、`policy-gateway-service` 断言自动 moderation evidence、admin moderation API 断言 case detail 能返回 structured complaint evidence。

## 2026-03-12 fourth implementation slice
- `ReviewService` 新增 `transferCase()` 与 `buildEvidenceExport()`：operator 现在可以把活跃 case 转派给新的审核员，同时生成结构化 `case_transferred` evidence 和 action log，并按 case 聚合 targets/tasks/evidence/action logs/linked complaint/appeal 构建 evidence export。
- admin API 新增 `POST /v1/admin/moderation/cases/:caseId/transfer` 与 `GET /v1/admin/moderation/cases/:caseId/evidence-export`；`GET /v1/admin/moderation/cases/:caseId` 也开始返回 `linked_complaint` / `linked_appeal`，让 case detail 能直接渲染 complaint/appeal panel。
- admin 前端把单栏 case detail 升级成 tabbed workbench：Overview、投诉/申诉、Evidence、Tasks、Export 五个标签页；支持转派、导出 evidence package，并能预览 linked complaint/appeal 与 action-log-backed export JSON。
- 测试新增 transfer/export 覆盖：`review-service` 断言 active case transfer 与 linked complaint evidence export，`admin-moderation-api` 断言 linked complaint panel、transfer route 与 evidence export route 的返回契约。

## 2026-03-12 fifth implementation slice
- core container 现在为 `ReviewService` / `ComplaintAppealService` 注入共享 `NotificationService`，`/v1/me/notifications` 也改为复用 container wiring；因此 in-memory 测试环境与 Prisma 环境都能观察到统一的 governance notification 行为。
- `ComplaintAppealService` 在 complaint/appeal 创建并进入 case 后会立即发送 typed GOVERNANCE 通知；`ReviewService` 在 linked complaint/appeal resolve/reopen 时同步 ticket 状态、resolution/result metadata，并向举报人/申诉人发送结案或重新审核通知。
- Safety Center 从双列表升级为 timeline-first 页面：整合 reports、appeals 和 GOVERNANCE notifications，增加“状态时间线”、未读治理更新计数、`全部标记已读` 操作，并在 ticket list 中展示 case-linked resolution/action 细节。
- 测试补齐用户面与通知闭环：`complaint-appeal-service` 断言 complaint/appeal 创建通知，`review-service` 断言 linked request 在 resolve/reopen 时的状态同步与通知，`admin-moderation-api` 断言用户 `/v1/reports` 与 `/v1/me/notifications` 可观测到结案结果，前端新增 `SafetyCenterPage` 时间线渲染测试。

## 2026-03-12 sixth implementation slice
- `ComplaintAppealService` 现在支持 `private_session` 举报的 owner-only 校验，并将 comment/chat/private/proactive 相关 complaint/appeal GOVERNANCE 通知正文从 `target_type:id` 改为“提交入口 + 目标对象 + case 队列”式 copy；`ReviewService` 的 resolve/reopen 通知正文也同步带出目标对象与重开原因。
- 前端举报入口已从帖子扩展到评论区、聊天室发言、私聊会话和通知 bell 里的主动私信提醒：`CommentList`、`ChatRoomPage`、`PrivateChatPage`、`Layout` 都可直接发起 complaint，并在原位显示 Safety Center 回执文案。
- Safety Center 时间线从基础版扩成 workflow-first：每条 timeline entry 现在都会展示阶段 badge、提交入口、目标对象和阶段说明；举报/申诉列表也不再只显示原始 `target_type:id`，而是改成更可读的 context line。
- 测试新增或补强 `CommentList`、`ChatRoomPages`、`PrivateChatPage`、`Layout`、`SafetyCenterPage` 以及通知正文断言，确保四类新增入口、workflow copy 和 typed GOVERNANCE notification 不回退。

## 2026-03-12 seventh implementation slice
- `ReviewService` 新增 `releaseCase()` 与 redacted `buildEvidenceExport({ redaction: 'operator' | 'share' })`，把 case release policy、share-safe evidence package、`case_released` action log/evidence 一并收口到 foundation service。
- admin moderation API 新增 `POST /v1/admin/moderation/cases/:caseId/release`，并为 `GET /v1/admin/moderation/cases/:caseId/evidence-export` 增加 `redaction=operator|share` 校验，锁住 evidence redact/export contract。
- admin 前端补齐 operator 收尾能力：case detail 现在可释放回队列、按 queue 显示 SOP/checklist，并在 export tab 中切换内部导出/分享导出与 redaction notes。
- 新增 `AdminPanel` 前端测试，直接覆盖 queue-specific SOP、release action 与 export redaction UI；配合既有 `review-service` / `admin-moderation-api` 测试，`T-089` 的 operator/user 双面证据已完整闭环。

## 2026-03-12 eighth implementation slice
- review 发现 `claimTask()` 可被他人直接抢占、`assignCase()` 能绕过 reopen 直接复活 closed case、`reopenCase()` 可在 open case 上重复创建 follow-up task，导致 `claim/lock` 与 lifecycle invariant 只停留在文档层。
- `ReviewService` 现已补上 foundation-level guard：已认领任务禁止被其他 operator 抢占；`assignCase()` / `resolveCase()` 禁止对 closed case 直接改写；`reopenCase()` 禁止对已打开 case 重复 reopen；share export 额外 redacts `claim_token`、`assigned_to_user_id`、transfer/release assignee 字段。
- admin 前端同步收紧按钮状态：closed case 不再展示可执行的 assign/resolve/transfer/release 动作，open case 不再允许重复 reopen，`ASSIGNED` task 也不再继续显示可点击的“认领任务”。
- 测试补成负路径闭环：`review-service` 新增 claim stealing / closed-case lifecycle / duplicate reopen 断言；`admin-moderation-api` 新增 duplicate claim、resolved case assign、duplicate reopen 的 400 回归，并锁住 share export 的 claim/assignee redaction。
