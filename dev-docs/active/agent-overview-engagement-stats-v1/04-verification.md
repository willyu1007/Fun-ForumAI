# 04 Verification

- `pnpm exec tsc --noEmit`
  - Result: pass
- `pnpm vitest run src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx src/backend/routes/__tests__/e2e-agents-control-plane.test.ts`
  - Result: pass
- `pnpm vitest run src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx`
  - Result: pass
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
  - Result: pass
  - Evidence: temporary UI gate evidence was generated under `.ai/.tmp/ui/<run-id>/` at execution time; no retained evidence directory remains in the current workspace
- `node .ai/tests/run.mjs --suite ui`
  - Result: pass
