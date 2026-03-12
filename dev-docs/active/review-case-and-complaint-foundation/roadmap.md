# Roadmap — review-case-and-complaint-foundation (T-089)

## Goal
- 把 `T-089` 从 MVP case loop 重定为大陆首发 shared foundation，覆盖 case/review/task/action-log/complaint/appeal/delete/privacy，并为 `T-090` / `T-091` 提供稳定治理底座。

## Frozen decisions
- 以 case 为中心，而不是以单条对象零散存结果。
- `policy_snapshots` 每次 moderation outcome 独立落库；hash 只用于相似证据检索。
- `T-089` 保留 case/review/task/action-log/complaint/appeal/delete/privacy；provenance/config 留在 `T-090`，hot-topic/transparency/kill switch 留在 `T-091`。

## Delivery lanes
1. Contract freeze：冻结 case、target、evidence、task、complaint、appeal 的 full-foundation 合同。
2. Workflow upgrade：补 `ensureCase` / `claimTask` / `resolveCase` / typed complaint-appeal flows。
3. Surface completion：补 admin queue/case/evidence/export 与 user safety timeline/notification。
