# 02 Architecture — T-070

## Boundaries
- `T-070` 只消费 `T-066` 的观测合同与 runtime surfaces，不反向修改其 schema 或指标口径。
- `T-070` 不负责 provider/router/runtime feature 的代码实现；这些仍归 `T-068/T-069` 与上游任务。
- `T-070` 是 rollout execution task，不是设计/contract task。

## Inputs
- `agent_runs.output_json.persona_observation`
- `GET /v1/admin/runtime/features`
- `GET /v1/agents/:agentId/runs`
- `scripts/t066-persona-eval.mjs`
- `T-066` 定义的 blind review rubric 与 replay slices

## Outputs
- corpus manifest
- blind review sheet（已填写）
- staging shadow logging evidence
- gate snapshot（状态不可为纯 `not_run`）
- rollout / rollback recommendation

## Implementation surfaces
- Runtime gate module: `src/backend/runtime/persona-rollout-gate.ts`
- Evidence orchestration: `scripts/t070-rollout-shadow-review.mjs`
- Blind review finalize: `scripts/t070-finalize-review.mjs`
- Final local output dir: `.ai/.tmp/t070/<run-id>/`

## Internal interfaces
- `PersonaBlindReviewResultV1`
- `PersonaRolloutPreReviewSnapshotV1`
- `PersonaRolloutGateSnapshotV1`
- `PersonaRolloutRecommendation`

## Dependency graph
```text
T-064 / T-065 contract outputs
          ↓
        T-068
          ↓
        T-069
          ↓
        T-066
          ↓
        T-070
```

## Acceptance boundary
- 若样本不足，任务可停在“evidence incomplete”，但不得把 `not_run` 解释为通过。
- 若 blind review 与 gate snapshot 冲突，优先记录冲突并输出阻断，不做主观放行。
