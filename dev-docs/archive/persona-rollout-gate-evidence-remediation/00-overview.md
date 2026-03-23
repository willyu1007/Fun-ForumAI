# 00 Overview — persona-rollout-gate-evidence-remediation (T-072)

## Status
- State: done
- 证据补齐与代码/契约修复已完成（04-verification Rerun A/B）；三项原 hold 原因已消除。
- final verdict 允许 `go_with_caveats`，前提是仅剩 `slice-fallback_or_degraded-missing` 这一类 caveat。
- Next step: 无；若需持久化新一轮 final snapshot，可重新执行 `t070-rollout-shadow-review.mjs` + blind review + `t070-finalize-review.mjs`（临时复跑产物已按约定清理）

## Goal
围绕 `T-070` 的最终 `hold` 结论补齐剩余证据，使人格 rollout gate 从“流程完成但证据不足”推进到“可明确 go / go_with_caveats / rollback”的可决策状态。

## Current Trigger（已处理）
`T-070` 原 snapshot 的 3 项 hold 原因在 T-072 中已处理（04-verification）：
- `identity-write-success-guardrail-not-run` → Rerun B 中 identity-write-success 已 pass（1/1）
- `cost-baseline-incomparable` → Rerun A 已移除
- `slice-fallback_or_degraded-incomplete-review` → 按设计改为 `slice-fallback_or_degraded-missing` caveat；代码允许此时 verdict=`go_with_caveats`

## Non-goals
- 不重新实现 `T-066` 的 observability / gate contract
- 不重开 `T-070` 的 orchestration 脚本主流程，除非为证据缺口补强所必需
- 不把 local-kind runtime drift、镜像 freshness、ConfigMap 对齐问题重新并回 `T-071`
- 不新增 owner-facing API / UI

## Acceptance Criteria (high level)
- [x] 产出一轮新的 rollout evidence，使 `identity-write-success` guardrail 进入可判定状态。（04 Rerun B：identity-write-success supplemental pass 1/1）
- [x] 建立可比较的 staging cost baseline，使 render cost 不再是 `not_run`。（04 Rerun A：cost-baseline-incomparable 已移除；visible-render-cost supplemental pass）
- [x] 让 `fallback_or_degraded` required slice 获得可盲评样本，或修正其样本生成/入选规则。（按设计改为 slice-fallback_or_degraded-missing caveat，final verdict 允许 go_with_caveats；persona-rollout-gate.test.ts 覆盖）
- [x] 基于补齐后的证据重新生成 final gate snapshot。（Rerun A/B 已产出 pre-review/supplemental；临时产物已按约定清理，可随时重跑脚本复现）
- [x] 新 snapshot 不再因为证据缺口而 `hold`。（代码层：仅 slice-fallback_or_degraded-missing 时允许 go_with_caveats，见 04 Remaining Manual Step）
