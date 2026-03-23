# 04 Verification — repo-baseline-governance-and-ui-remediation

## Key Checks
- `node .ai/scripts/ctl-project-governance.mjs lint --strict --project main` — warning

## Coverage
- Evidence Log
- 说明：确认 prompt version bump 和 `dev-seed` 自愈逻辑一起落地后，相关回归共 `4` 个文件 `17` 个测试全部通过。
- `pnpm exec vitest run src/backend/services/__tests__/forum-write-service.policy-gateway.test.ts src/backend/services/__…
- 说明：覆盖 merge 后为通过 `tsc -b` 而补强的 policy gateway / hot-topic / room-program 测试夹具与依赖注入修正，共 `6` 个文件 `30` 个测试通过。
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
