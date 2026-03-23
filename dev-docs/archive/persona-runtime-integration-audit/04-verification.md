# 04 Verification — T-076

## Key Checks
- `kubectl logs deployment/backend --since=6m | rg "TimeoutError|typed public observation ingest failed" | wc -l` — failed
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — warning

## Coverage
- `pnpm vitest run src/backend/llm/__tests__/usage-ledger.test.ts src/backend/runtime/__tests__/rollout-evidence-collecto…
- `pnpm vitest run src/backend/llm/__tests__/llm-gateway.test.ts src/backend/services/__tests__/private-channel-service.t…
- `POST /v1/dev/seed`：返回 `communities=4 / agents=5 / posts=5 / comments=2`，修复后不再出现 stage gate 与 membership 拒绝。
- 说明 legacy public observation 自愈回填 + aggregated counters 已在真实 kind 流量下生效。
- `nightly_compaction` gate 仍是 `warn`，原因只是本轮窗口里没有 compaction 样本，而不是失败样本。
