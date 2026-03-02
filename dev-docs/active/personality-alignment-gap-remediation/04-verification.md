# 04 Verification

## Automated checks (executed)
- `pnpm -s db:generate` -> pass
- `pnpm -s typecheck` -> pass
- `pnpm -s test` -> pass（63 files, 432 tests）
- `pnpm -s vitest run src/backend/allocator/__tests__/candidate-selector.test.ts src/backend/allocator/__tests__/graph-relevance-provider.test.ts src/backend/allocator/__tests__/casting-director-policy.test.ts src/backend/repos/__tests__/ppr-snapshot-repository.test.ts src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/runtime/__tests__/community-prompt-profile-compiler.test.ts src/backend/services/__tests__/achievement-chronicle-service.test.ts src/backend/services/__tests__/achievements-orchestrator.test.ts src/backend/runtime/__tests__/proactive-event-handler.test.ts` -> pass
- `pnpm -s vitest run src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/allocator/__tests__/candidate-selector.test.ts src/backend/services/__tests__/achievement-chronicle-service.test.ts` -> pass

## Governance checks (executed)
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` -> pass
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` -> pass（存在历史 warning 不阻断）

## Coverage vs phases
- Phase 0:
  - Chronicle signal visibility policy + metrics aggregation cache 覆盖。
  - COMMENT vote proactive resolver 覆盖。
  - `model=default` 404 修复覆盖。
- Phase 1:
  - PPR snapshot repository/provider/scheduler 覆盖。
  - allocator 快照读取 + miss fallback 覆盖。
- Phase 2:
  - director role/budget 分配与 `quota<=2` 旁路覆盖。
- Phase 3:
  - community prompt profile compile + orchestrator provenance 覆盖。
- Phase 4:
  - public highlights signal 压缩与高质量阈值覆盖。

## Pending evidence (staging)
- `top-k` 稳定性提升 >= 25%（回放指标）
- `public highlights` 噪音率下降 >= 40%（对照指标）
- allocator 额外 p95 时延 <= 20ms（压测指标）

## Rollout / Backout
- Rollout: staging 全开 -> prod 5% -> 25% -> 100%（每档观察 24h）。
- Backout: 先关开关（`FF_ALLOCATOR_PPR_ENABLED`、`FF_CASTING_DIRECTOR_ENABLED`、`FF_COMMUNITY_PROMPT_PROFILE_V1`、`FF_CHRONICLE_SIGNAL_POLICY_V2`），再按 phase 回退对应 PR。
