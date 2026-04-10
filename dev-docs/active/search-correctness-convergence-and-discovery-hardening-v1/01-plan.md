# 01 Plan

## Phases

1. Phase A: 创建 `T-915` 任务包并同步 governance。`[completed]`
2. Phase B: 修复 search projection drift、discoverability matrix 与 targeted reconcile。`[completed]`
3. Phase C: 升级 `/v1/search` contract、空查询 discovery 与 search telemetry。`[completed]`
4. Phase D: 收敛 `/v1/agents` 搜索、切换 `/agents` 页面，并增强 comments thread-context。`[completed]`
5. Phase E: 运行 targeted tests / typecheck / governance sync-lint，并记录 rollout/backout。`[completed]`
6. Phase F: consume `T-948` lean bundles and close search hot-path regressions。`[pending]`

## Entry Contract

- `T-948` 必须先交付并冻结：
  - search hit hydration bundle
  - thread refresh bundle
  - fallback policy
- 若 handoff 只是一句“改成 lean path”，没有 bundle inventory 和 migration target，本包不得开始 Phase F。

## Detailed Steps

- 保持已完成的 correctness/discoverability/search contract work 不回退。
- 在 `T-948` 交付后，切换 search hit hydration 与 projection refresh 到 lean bundles，确保不再默认回读完整 forum thread detail。
- 重新执行 reconcile/runtime health/search regression，确认 public contract 不变而内部热路径已收口。
- 更新 search-side handoff 文档，使未来维护者清楚哪些 bundle 来自 `T-948`，哪些 regression 仍由 `T-915` 持有。

## Handoff Review Before Closeout

- 在 program closeout 之前，必须 review：
  - `T-948` handoff 是否被完整消费
  - reconcile/runtime health/search regression 是否基于新热路径重新跑过
  - `/v1/search` public contract 是否保持 additive/compatible
- review 输出必须落到：
  - `03-implementation-notes.md`：search-side adoption note
  - `04-verification.md`：reconcile/runtime health/search regression evidence

## Stop / Escalation Conditions

- 若 search provider 仍需自己理解 full-thread semantics 才能生成 search card，本包不得 closeout。
- 若 lean path 引入了 public contract drift，本包必须先回滚 adoption 结论并回写 `T-946`。

## Exit Criteria

- `00-overview.md` 的 acceptance criteria 全部满足。
- `T-948` handoff 已被消费，不存在 `T-915` 自己定义的并行 lean bundle。
- 基于新内部路径的 reconcile/runtime health/search regression 证据已写入 `04-verification.md`。

## Risks & Mitigations

- Risk: `T-948` handoff 不够明确，导致 `T-915` 自己重新拼一套 lean bundle。
  - Mitigation: `T-948` 必须显式命名 internal bundle 和 migration target，`T-915` 只消费、不再定义。
- Risk: 切到 lean bundle 后，搜索 contract 虽然不变，但 runtime health 或 reconcile 行为出现静默偏差。
  - Mitigation: 本包保留 reconcile/runtime health/regression closeout owner 身份，不能只做代码切换不做证据收口。
