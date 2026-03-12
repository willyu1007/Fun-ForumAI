# 01 Plan — T-087

## Phase 0 Governance Freeze
1. 新增 `M-010 Mainland Launch Safety` 与 `F-050 Risk Control & Review Launch Track`。
2. 固定 `R-050~R-053` 对应四个子包。
3. 固定执行顺序：`T-087 -> T-088 -> T-089 -> T-090 -> T-091`。

## Phase 1 Channel Hardening
1. `T-088` 统一 `forum/chat/private/proactive` 的策略评估入口。
2. 接入 `IdentityGate`、`SafeReplyService`、`RiskEventService`、AI label。
3. 对大陆 public 关闭 availability-first fallback。

## Phase 2 Review And Complaint
1. `T-089` 落 `policy_snapshots`、`moderation_cases`、`review_tasks`、`complaint_tickets`、`appeal_requests`。
2. 最小 admin queue/case/evidence/manual review UI/API。
3. 扩展 message/private/proactive 目标的治理动作持久化。

## Phase 3 Provenance And Config Governance
1. `T-090` 记录 `used_memory_ids`、effective disclosure、rewrite cause。
2. 加 `public_disclosure_cap` 和风险对象服务端压帽。
3. 对 publish/proactive 相关 config 做 lint/risk/review。

## Phase 4 Topic Policy And Transparency
1. `T-091` 实装 default-deny topic 域矩阵。
2. 增 drift detection、kill switch、推荐降权。
3. 增举报/申诉与用户透明告知。
