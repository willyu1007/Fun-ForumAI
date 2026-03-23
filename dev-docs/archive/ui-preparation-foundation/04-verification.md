# 04 Verification — ui-preparation-foundation

## Key Checks
- `pnpm ui:build` — pass
- `pnpm ui:check` — pass
- `pnpm typecheck` — pass
- `pnpm build` — pass
- `pnpm lint` — pass
- `pnpm exec vitest run src/backend/services/__tests__/complaint-appeal-service.test.ts src/backend/services/__tests__/rev…` — pass

## Coverage
- UI Gate 情况总览
- 1. 已接入 CI 的 UI 门禁（Node）
- **状态**：已落地，每次 PR/push 都会跑。
- 2. UI Governance Gate（Python，未入 CI）
- **命令**：`python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
