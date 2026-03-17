# 02 Architecture — T-072

## Scope Boundary
`T-072` 是 rollout evidence remediation task，不是 runtime contract task，也不是 local-kind environment repair task。

它只承接 `T-070` final verdict 中的 3 个证据缺口：
1. `identity-write-success-guardrail-not-run`
2. `cost-baseline-incomparable`
3. `slice-fallback_or_degraded-incomplete-review`

## Upstream / Downstream

### Upstream
- `T-066 persona-observability-eval-v1`
  - 提供 render log / observation / gate contract
- `T-070 persona-rollout-shadow-review`
  - 提供真实样本、blind review 模板、pre-review / final snapshot
- `T-071 local-kind-runtime-consistency-remediation`
  - 已清除 runtime blocker，使 `T-070` 可以跑到 final verdict

### Downstream
- 新一轮 rollout decision
- 可能的发布决策：
  - `go`
  - `go_with_caveats`
  - `rollback`

## Authoritative Surfaces
本任务只允许基于这些 surface 补证据，不另起协议：
- `persona-observation-v1`
- `gate-summary.pre-review.json`
- `gate-snapshot.final.json`
- `rollout-verdict.md`
- `scripts/t066-persona-eval.mjs`
- `scripts/t070-rollout-shadow-review.mjs`
- `scripts/t070-finalize-review.mjs`

## Design Constraints
- 不新增 owner-facing UI
- 不改 `T-070` verdict 词表
- 不重写 blind review rubric
- 不将 local-kind / k8s 对齐问题重新并入本任务

## Key Risks

### Risk 1
`identity-write-success` guardrail 的缺口不只是“缺证据”，而是 contract 没定义清楚何时算 success。

### Risk 2
cost baseline 的“可比性”如果没有严格约束样本窗口，很容易把不同模型/不同 scene 混比，得到伪结论。

### Risk 3
`fallback_or_degraded` 可能暴露的是语料/提取器设计问题，而不是运行时生成问题；如果不修样本入选规则，会反复得到不可盲评样本。

## Preferred Resolution Order
1. 先补 `identity-write-success`
2. 再补 cost baseline comparability
3. 最后处理 fallback/degraded slice

原因：
- 前两者更像 guardrail evidence 问题，定义边界相对清晰
- 第三项可能需要回到 sample selection / rubric 边界，风险最大
