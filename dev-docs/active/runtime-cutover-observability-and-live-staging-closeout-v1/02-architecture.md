# 02 Architecture

## Boundaries

- `T-901` 负责 execution-plan / policy / adapter binding 的 contract 和 runtime core。
- `T-935` 负责 cloud env / injection / IaC skeleton / go-live runbook。
- `T-936` 只负责 cutover sequencing、observability contract、staging live close-out。

## Key Decisions

- staging live gate 必须建立在真实 cloud injection boundary 之上，不接受本地 key / 本地 Redis 替代。
- `provider_id + model_id` 是 billing、fallback evidence 和 live smoke attribution 的共同键。
- cutover 顺序按“先 hidden/worker lanes，后 visible lanes；先 trace/ledger，后 promote gate”推进，降低前台回退风险。
- 本包承担“剩余双轨语义收口”：
  - callsite 参数硬编码迁出
  - deprecated env/emergency override 的证据化
  - execution-plan trace 从内存/日志走向可验证的账务/验收面

## Interfaces

- usage ledger 新增 selected policy / ordered candidates / selected credential / fallback history
- staging/prod evidence 必须指出是否启用了任何 debug / emergency override，以及其原因和退出条件
- staging live checklist 必须引用 `T-935` 的 cloud readiness runbook
- `verify:launch:staging` 或后继脚本应输出 lane-level success/failure evidence
