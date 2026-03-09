# 01 Plan — T-072

## Phase 0 Governance
1. 将 `T-072` 注册到 `F-020 / R-029`。
2. 在 `T-070` 文档中显式声明：当前 `hold` 的后续 remediation 由 `T-072` 承接。

## Phase 1 Identity Write Guardrail
1. 明确 `identity-write-success` guardrail 当前为何是 `not_run`：
   - 是 offline replay 没有判定逻辑
   - 还是实际 observation payload 未覆盖该字段
2. 定义最小补强方案：
   - 优先复用现有 `persona_observation.identity_write`
   - 不新增 owner-facing API
3. 验收目标：
   - 新 evidence run 中 `identity-write-success` guardrail 不再是 `not_run`

## Phase 2 Cost Baseline Comparability
1. 固定 baseline 来源：
   - 明确用哪一轮 staging/persona eval 作为 cost baseline
   - 明确样本窗口、scenes、callsites 和模型组合的可比条件
2. 为 `visible-render-cost` guardrail 补齐比较输入：
   - 避免 offline replay 只能报告 “avg=xxx tokens” 但无法判定
3. 验收目标：
   - 新 final snapshot 中 `cost-baseline-incomparable` 不再出现

## Phase 3 Fallback/Degraded Slice Remediation
1. 检查 `fallback_or_degraded` 的样本生成逻辑：
   - 当前为什么会选出 `[[content unavailable]]`
   - 这些 run 是否真的适合 blind review
2. 两条备选路径，只能选其一并显式记录：
   - 路径 A：补到可评审文本样本，再执行 blind review
   - 路径 B：修正规则，不再把不可见文本样本计入 required slice
3. 验收目标：
   - `fallback_or_degraded` 在新的 final snapshot 中要么 `pass`，要么被 contract-level 正确降级为非阻断 caveat

## Phase 4 Re-run and Final Decision
1. 重跑 `T-070` evidence 或等价 follow-up evidence flow。
2. 重做 blind review / finalize。
3. 产出新的：
   - `gate-snapshot.final.json`
   - `rollout-verdict.md`
4. 结论约束：
   - 允许 `go`
   - 允许 `go_with_caveats`
   - 允许 `rollback`
   - 不允许因证据不全继续 `hold`

## Exit Criteria
- `identity-write-success-guardrail-not-run` 已消失
- `cost-baseline-incomparable` 已消失
- `slice-fallback_or_degraded-incomplete-review` 已消失
- 新 verdict 已明确落在 `go / go_with_caveats / rollback`
