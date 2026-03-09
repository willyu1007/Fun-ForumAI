# 00 Overview — persona-rollout-gate-evidence-remediation (T-072)

## Status
- State: in-progress
- 说明: follow-up task；本轮开始实施 `T-072` evidence remediation
- 前置:
  - `T-070 persona-rollout-shadow-review` 已完成 blind review / finalize，当前 verdict=`warn/hold`
  - `T-071 local-kind-runtime-consistency-remediation` 已完成，runtime blocker 已清除
- Next step: 落地 `t066/t070/persona-rollout-gate` 修复，补跑验证并同步 project governance

## Goal
围绕 `T-070` 的最终 `hold` 结论补齐剩余证据，使人格 rollout gate 从“流程完成但证据不足”推进到“可明确 go / go_with_caveats / rollback”的可决策状态。

## Current Trigger
`T-070` 当前最终 snapshot 为：
- evidence run: `.ai/.tmp/t070/t070-2026-03-09T08-07-58-214Z`
- `overall_status=warn`
- `recommendation=hold`

当前 `hold` 的直接原因只有 3 项：
- `identity-write-success-guardrail-not-run`
- `cost-baseline-incomparable`
- `slice-fallback_or_degraded-incomplete-review`

## Non-goals
- 不重新实现 `T-066` 的 observability / gate contract
- 不重开 `T-070` 的 orchestration 脚本主流程，除非为证据缺口补强所必需
- 不把 local-kind runtime drift、镜像 freshness、ConfigMap 对齐问题重新并回 `T-071`
- 不新增 owner-facing API / UI

## Acceptance Criteria (high level)
- [ ] 产出一轮新的 rollout evidence，使 `identity-write-success` guardrail 进入可判定状态
- [ ] 建立可比较的 staging cost baseline，使 render cost 不再是 `not_run`
- [ ] 让 `fallback_or_degraded` required slice 获得可盲评样本，或修正其样本生成/入选规则，避免 `[[content unavailable]]` 继续进入 required blind review
- [ ] 基于补齐后的证据重新生成 final gate snapshot
- [ ] 新 snapshot 不再因为证据缺口而 `hold`
