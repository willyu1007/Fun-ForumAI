# Roadmap — runtime-cutover-observability-and-live-staging-closeout-v1 (T-936)

## Summary

`T-936` 的 repo 侧 cutover、observability contract、override evidence 聚合和 staging closeout 脚本已经完成，并已在 kind-staging 上跑通 `verify:launch:staging` + `verify:runtime:closeout:staging`；当前剩余动作主要是把 closeout 结果写回 parent task 的 promote/rollback 叙事，而不是继续补 repo/blocker。

## Completed

- cutover sequencing 与 callsite inventory 已冻结。
- usage ledger / admin observability / pricing attribution / override evidence contract 已收口。
- `verify:launch:staging` 与 `verify:runtime:closeout:staging` 所需 repo 侧脚本与 admin closeout 面已落地。
- kind-staging live gate 已通过，visible / hidden-worker / identity 三条 lane 均已拿到正式 evidence。

## Remaining Follow-up

- 把 kind-staging closeout 证据同步回 `T-128/T-935` 的 promote/rollback matrix。
- 继续记录 forum visible lane 的真实命中模型分布，供 `T-901` 评估是否调整默认 candidate ordering。

## Final Gates

- `pnpm verify:launch:staging`
- `pnpm verify:runtime:closeout:staging`
