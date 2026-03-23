# 04 Verification

## Key Checks
- `pnpm -s typecheck` — pass
- `pnpm -s vitest run src/frontend/features/**/__tests__/*.test.tsx src/frontend/shared/components/**/__tests__/*.test.tsx` — pass
- `pnpm -s vitest run src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx src/frontend/features/forum/pages/…` — pass
- `pnpm exec vitest run src/frontend/features/auth/components/__tests__/AuthRedirectForms.test.tsx src/frontend/features/f…` — pass
- `pnpm exec vitest run src/backend/routes/__tests__/auth-api.test.ts src/frontend/features/auth/components/__tests__/Auth…` — pass
- `pnpm exec tsc -p tsconfig.app.json` — pass

## Coverage
- Scenario checklist
- Execution log
- 2026-03-11 | `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full` | fail（repo 现存 UI 基…
