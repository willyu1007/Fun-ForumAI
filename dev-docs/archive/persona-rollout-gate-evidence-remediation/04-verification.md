# 04 Verification — T-072

- 2026-03-09 task bundle initialized.
- 2026-03-09 source evidence confirmed:
  - `T-070` final snapshot exists:
    - `.ai/.tmp/t070/t070-2026-03-09T08-07-58-214Z/gate-snapshot.final.json`
  - `T-070` final verdict exists:
    - `.ai/.tmp/t070/t070-2026-03-09T08-07-58-214Z/rollout-verdict.md`
  - current result:
    - `overall_status=warn`
    - `recommendation=hold`
- 2026-03-09 governance verification:
  - `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog`
  - `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - result:
    - `T-072` 已出现在 registry/dashboard/task-index
    - governance lint passed
    - 仅保留仓库内与本任务无关的既有 warning

## Code/Test Verification
- `pnpm exec vitest run src/backend/runtime/__tests__/persona-rollout-gate.test.ts src/backend/services/__tests__/memory-service.context-memory.test.ts src/backend/repos/__tests__/pg-context-memory-repository.test.ts`
  - result: pass (`19` tests)
- `pnpm exec vitest run src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/registry-contract.test.ts src/backend/runtime/__tests__/persona-rollout-gate.test.ts src/backend/services/__tests__/memory-service.context-memory.test.ts src/backend/repos/__tests__/pg-context-memory-repository.test.ts`
  - result: pass (`28` tests)
- `pnpm exec tsc -b --pretty false`
  - result: pass
- `node scripts/t070-rollout-shadow-review.mjs --help`
  - result: pass
- `node scripts/t070-finalize-review.mjs --help`
  - result: pass

## Staging Rerun Verification
- refreshed staging runtime:
  - `node scripts/k8s-local-staging.mjs --skip-db-migrate`
  - result: pass; runtime fingerprint verified

### Rerun A — after code fix, before hidden-lane fallback
- command:
  - `node scripts/t070-rollout-shadow-review.mjs --skip-staging-setup`
- result:
  - `pre_review_status=warn`
  - `recommendation=hold`
  - fixed:
    - `cost-baseline-incomparable` removed
    - `callsite-private-channel-reply-not-advanced` removed
    - `slice-fallback_or_degraded-incomplete-review` replaced by `slice-fallback_or_degraded-missing`
  - still failing:
    - `identity-write-success-guardrail-not-run`
    - `private_chat_digest_status=FAILED`
- runtime evidence:
  - pod log now shows correct private routing:
    - `intent=private_digest`
    - `prompt_ref=internal-private-chat-summary-extract`
  - actual failure:
    - `Failed to resolve any credential for deepseek-openai/deepseek-reasoner`
  - note:
    - 临时复跑产物已在状态记录后清理

### Rerun B — after hidden director fallback registry update
- refreshed staging runtime:
  - `node scripts/k8s-local-staging.mjs --skip-db-migrate`
  - result: pass; runtime fingerprint verified
- command:
  - `node scripts/t070-rollout-shadow-review.mjs --skip-staging-setup`
- result:
  - `pre_review_status=warn`
  - `recommendation=hold`
  - `private_chat_digest_status=COMPLETED`
  - `identity-write-success` supplemental: `pass` (`1/1 successful`)
  - `visible-render-cost` supplemental: `pass`
  - blocking callsites:
    - `post-scheduler-create-post`: pass
    - `private-channel-reply`: pass
  - only remaining pre-review issue:
    - `slice-fallback_or_degraded-missing`
- current status against original three blockers:
  - `identity-write-success-guardrail-not-run`: fixed
  - `cost-baseline-incomparable`: fixed
  - `slice-fallback_or_degraded-incomplete-review`: fixed as designed; replaced by missing-slice caveat
  - note:
    - 临时复跑产物已在状态记录后清理

## Remaining Manual Step
- `T-072` 的 repo 修复与 staging rerun 已完成。
- 本轮按要求删除了临时测试/复跑产物，因此没有保留可直接 finalize 的临时 output 目录。
- 若要生成新的 final rollout verdict，需要重新执行一轮：
  - `node scripts/t070-rollout-shadow-review.mjs --skip-staging-setup`
  - 完成 blind review 后执行 `node scripts/t070-finalize-review.mjs --input <new-output-dir>`
- 代码层已经通过单测验证：
  - 当其他 required slice 健康且仅剩 `slice-fallback_or_degraded-missing` 时，final verdict 将允许 `go_with_caveats`，不会再被压成 `hold`。
