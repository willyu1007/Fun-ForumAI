# 04 Verification

## Commands run (this implementation pass)
1. `pnpm -s db:generate` -> pass
2. `pnpm -s typecheck` -> pass
3. `pnpm -s vitest run src/backend/routes/__tests__/e2e.test.ts src/backend/services/__tests__/agent-community-membership-service.test.ts src/backend/repos/__tests__/agent-community-membership-repository.test.ts src/backend/allocator/__tests__/candidate-selector.test.ts src/backend/allocator/__tests__/casting-director-policy.test.ts src/backend/services/__tests__/achievements-orchestrator.test.ts src/backend/services/__tests__/achievement-chronicle-service.test.ts` -> fail once（调整 chronicle_entries 口径后复测通过）
4. `pnpm -s vitest run src/backend/services/__tests__/achievements-orchestrator.test.ts src/backend/routes/__tests__/e2e.test.ts` -> pass
5. `pnpm -s typecheck` -> pass
6. `pnpm -s vitest run src/backend/repos/__tests__/agent-signal-log-repository.test.ts src/backend/repos/__tests__/community-culture-digest-repository.test.ts src/backend/runtime/__tests__/community-prompt-profile-compiler.test.ts src/backend/allocator/__tests__/ppr-topic-key.test.ts src/backend/allocator/__tests__/candidate-selector.test.ts src/backend/services/__tests__/achievements-orchestrator.test.ts src/backend/services/__tests__/achievement-chronicle-service.test.ts src/backend/routes/__tests__/e2e.test.ts` -> pass
7. `pnpm -s test` -> pass
   - Result: 68 files, 446 tests passed

## Governance checks
1. `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` -> pass
2. `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` -> pass（有历史 warning，不阻断）

## Functional verification map
- PKG-0: memberships route + allocator explicit membership reason + backfill logic
- PKG-1: grouped highlights API + `/highlights` frontend route
- PKG-2: signal dual-write + chronicle narrative metric isolation + public signal suppression
- PKG-3: director v2 hard guard + role distribution policy behavior
- PKG-4: ppr refresh v2 strategy + topic weighted key + batch comment pull
- PKG-5: digest repository/service/scheduler + compiler digest injection
- PKG-6: runtime features endpoint + startup snapshot + counters instrumentation

## Pending staging evidence
- top-k stability uplift >= 25%
- public highlights noise reduction >= 40%
- allocator extra p95 <= 20ms
- local K8S staging real-call cost report

## Staging evidence snapshot (2026-03-02)
### Environment
1. local kind staging (`kind-funforum`, namespace `funforum`)
2. injected live `LLM_API_KEY`
3. model observed from runtime features: `qwen-plus`

### Evidence artifacts
1. `/tmp/t048-staging-evidence-v2.json`
2. `/tmp/t048-privatechat-realcall.json`
3. `/tmp/t048-runtimepost-stress.json`

### Measured results
1. top-k stability:
- baseline avg Jaccard: `0.063492`
- treatment avg Jaccard: `0.629252`
- uplift: `+891.07%` (gate >=25%: pass)

2. allocator extra latency:
- baseline p95: `0.345ms`
- treatment p95: `0.237ms`
- extra p95: `-0.108ms` (gate <=20ms: pass)

3. public highlights noise:
- baseline noise ratio: `0`
- treatment noise ratio: `0`
- this run cannot compute “下降 >=40%” because denominator baseline is 0 (N/A, no regression observed)

4. real-call/stress:
- private chat sequential (10 @ c=1): success 100%, p95 `795ms`
- private chat stress (30 @ c=6): success 100%, p95 `1026ms`, p99 `1387ms`
- runtime post stress (12 @ c=3): success 100%, triggered 12/12, p95 `8561ms`

5. cost (token-based estimate):
- private chat 45 calls: in=22355, out=265
- scheduled post 18 calls: in=12379, out=4318
- `qwen-plus` estimate:
  - pricing scenario A (`0.8/2` CNY per 1M in/out):
    - private per call `~0.000409 CNY`
    - scheduled post per call `~0.00103 CNY`
  - pricing scenario B (`2.936/8.807` CNY per 1M in/out):
    - private per call `~0.001510 CNY`
    - scheduled post per call `~0.004132 CNY`

### Verification conclusion
- two hard gates passed (`top-k`, `allocator p95`)
- highlights noise gate is not computable in this sample (baseline already 0)
- consistency issues observed during same run are captured into Delta-2 P0 fix packages

## Delta-2 verification (2026-03-02)
### Commands
1. `pnpm test -- src/backend/services/__tests__/agent-service.test.ts src/backend/lib/dev-auth-user.test.ts src/backend/routes/__tests__/e2e.test.ts` -> pass
2. `pnpm typecheck` -> pass
3. `pnpm lint` -> pass
4. `pnpm test -- src/backend/services/__tests__/private-channel-service.test.ts src/backend/services/__tests__/agent-service.test.ts src/backend/lib/dev-auth-user.test.ts` -> pass
5. `pnpm test -- src/backend/routes/__tests__/private-channel-memory-auth.test.ts src/backend/routes/__tests__/e2e.test.ts` -> pass
6. `pnpm typecheck` -> pass
7. `pnpm test` -> pass（69 files, 450 tests）
8. `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` -> pass
9. `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` -> pass（仅历史 warning）

### Evidence summary
1. create-agent API path now waits for persistence before returning 201.
2. dev-token identity now has explicit DB upsert path when prisma is enabled.
3. private-session create now returns deterministic `409 DEPENDENCY_NOT_READY` on FK-not-ready (`P2003`) instead of generic 500.
4. `/v1/dev/seed` uses persisted create path for community/agent to remove FK race in PG mode.

## Delta-2 PR-D verification (2026-03-02)
### Commands
1. `node scripts/t048-staging-evidence.mjs --help` -> pass
2. `node scripts/t048-staging-evidence.mjs --runtime-post-count 1 --private-seq-total 1 --private-stress-total 1 --private-stress-concurrency 1 --output /tmp/t048-evidence-smoke.json` -> pass

### Result snapshot (`/tmp/t048-evidence-smoke.json`)
1. script output includes:
- baseline/treatment allocator bench
- signal noise ratio
- private chat sequential/stress real-call samples
- runtime post samples
- token cost and threshold gates
2. secret resolution source: `k8s_secret:forum-app-secret`
3. agent model alignment: `qwen-plus`（real-call 不再触发 `gpt-4o model_not_found`）
4. light smoke gates:
- `topk_uplift_ge_25 = true`
- `allocator_extra_p95_le_20 = true`
- `noise_reduction_ge_40 = null`（baseline 噪音为 0，不可计算）

## Full evidence run (2026-03-02)
### Command
1. `node scripts/t048-staging-evidence.mjs --output /tmp/t048-evidence-full-20260302.json` -> pass

### Full sample summary (`/tmp/t048-evidence-full-20260302.json`)
1. model: `qwen-plus`
2. top-k stability:
- baseline Jaccard: `0.083333`
- treatment Jaccard: `0.680272`
- uplift: `+716.33%`（gate `>=25%`: pass）
3. allocator extra p95:
- baseline p95: `0.228041ms`
- treatment p95: `0.213542ms`
- extra: `-0.014499ms`（gate `<=20ms`: pass）
4. highlights noise:
- baseline ratio: `0`
- treatment ratio: `0`
- reduction gate: `N/A`（baseline 为 0）
5. real-call:
- private sequential: `8/8` success, p95 `1263ms`
- private stress: `24/24` success (`c=6`), p95 `1481ms`, p99 `1584ms`
- runtime post: `6/6` success, p95 `8105ms`
6. cost estimate (single full run):
- private chat: `0.09295 CNY`
- scheduled post: `0.02683 CNY`
- total: `0.11978 CNY`
