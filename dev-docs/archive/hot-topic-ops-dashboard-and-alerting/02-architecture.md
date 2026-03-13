# 02 Architecture

- `HotTopicOpsService` 只消费现有 repo/service 数据，不引入新表。
- hot score 规则固定：
  - post = `approved_comment_count_last24h + report_count_24h * 5`
  - room = `message_count_last1h + report_count_24h * 5`
- `sampled_review_required` 在 `hot_score >= 20` 或 `report_count_24h >= 3` 时置位。
- 告警严重度固定：
  - `high`：`BLOCKED` 或 `drift_risk_score >= 0.82`
  - `medium`：`NO_RECOMMEND` 或 sampled review
  - `low`：其余
