# 04 Verification

- `pnpm exec tsc --noEmit`
  - Result: pass
- `pnpm vitest run src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx src/backend/routes/__tests__/e2e-agents-control-plane.test.ts`
  - Result: pass
- `pnpm vitest run src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx`
  - Result: pass
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
  - Result: pass
  - Evidence: `.ai/.tmp/ui/20260416T102506Z-2484/ui-gate-report.md`
- `node .ai/tests/run.mjs --suite ui`
  - Result: pass
