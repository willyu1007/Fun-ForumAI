# 01 Plan — T-087

## Phase 0 Governance Freeze
1. 新增 `M-010 Mainland Launch Safety` 与 `F-050 Risk Control & Review Launch Track`。
2. 固定 `R-050~R-053` 的 requirement 语义，并允许 `R-053` 下按职责拆分多个 task。
3. 固定执行顺序：`T-087 -> T-088 -> T-089 -> T-090 -> T-091 -> T-092 -> T-093`。

## Phase 1 Channel Hardening
1. `T-088` 统一 `forum/chat/private/proactive` 的策略评估入口。
2. 接入 `IdentityGate`、`SafeReplyService`、`RiskEventService`、AI label。
3. 对大陆 public 关闭 availability-first fallback。

## Phase 2 Review And Complaint
1. `T-089` 冻结 case-centered full foundation：`policy_snapshots`、`moderation_cases`、`review_tasks`、`governance_action_logs`、`complaint_tickets`、`appeal_requests` 与 delete/privacy typed workflow。
2. 升级 admin queue/case/evidence/complaint/appeal UI/API 到 claim/transfer/reopen/resolve、case detail tabs、evidence export。
3. 升级 user safety surfaces：post/comment/chat/private/proactive 举报入口、Safety Center 时间线、治理状态变更通知。
4. 保持 provenance/config 与 topic/transparency 边界在 `T-090` / `T-091`，不把这些逻辑吸回 `T-089`。

## Phase 3 Provenance And Config Governance
1. `T-090` 记录 `used_memory_ids`、effective disclosure、rewrite cause。
2. 加 `public_disclosure_cap` 和风险对象服务端压帽。
3. 对 publish/proactive 相关 config 做 lint/risk/review。

## Phase 4 Topic Policy And Transparency
1. `T-091` 实装 default-deny topic 域矩阵。
2. 增 drift detection、gray/deny keyword override、kill switch、推荐降权。
3. 增 sampled review 阈值与 `HOT_TOPIC` case 收口。
4. 补 forum/chat/private/safety/admin 等在位透明提示。

## Phase 5 Public Policy Surfaces
1. `T-092` 新增公开帮助中心与规则/隐私/AI 内容/热点规则/私聊实名/举报申诉删除说明页。
2. 从 `Layout`、社区页、帖子页、私聊页、Safety Center 暴露明确入口。

## Phase 6 Hot Topic Ops And Alerts
1. `T-093` 新增热点 dashboard 与 alerts API / UI。
2. 支持帖子 `NO_RECOMMEND`、房间 `hot_topic_mode` / `no_recommend` 控制。
3. 以 project hub、verification 与外部审计核对作为母包最终 closeout。
