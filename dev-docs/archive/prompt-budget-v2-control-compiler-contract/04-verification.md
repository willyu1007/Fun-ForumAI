# 04 Verification

## Key Checks
- `pnpm exec vitest run src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/runtime/__tests__/prompt-lay…` — pass
- `pnpm exec vitest run src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/llm/__tests__/prompt-engine.…` — pass
- `pnpm exec tsc --noEmit` — pass
- `pnpm exec eslint src/backend/runtime/prompt-orchestrator.ts src/backend/llm/prompt-engine.ts src/backend/runtime/__test…` — pass
- `node --import tsx <temp-live-forum/private script>` — pass
- `node --import tsx <temp-live-warning script>` — warning

## Coverage
- Scenario checklist
- [x] gateway 能记录 window mismatch warning 但不阻断请求
- Package review gate before T-115
- Follow-up handoff
- Execution log
