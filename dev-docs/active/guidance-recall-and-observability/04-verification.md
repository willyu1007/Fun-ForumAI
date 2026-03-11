# 04 Verification

## Executed verification commands

| Command | Expected result |
| --- | --- |
| `pnpm exec tsc -b --pretty false` | pass |
| `pnpm vitest run src/backend/guidance/__tests__/guidance-recall-scheduler.test.ts src/backend/services/__tests__/guidance-orchestrator.test.ts src/backend/routes/__tests__/guidance-api.test.ts src/backend/routes/__tests__/e2e-control-plane.test.ts src/frontend/shared/components/__tests__/Layout.test.tsx src/frontend/features/admin/components/__tests__/RuntimeDashboard.test.tsx` | pass |
| `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out dev-docs/active/guidance-recall-and-observability/artifacts/env/03-validation-log.md` | pass |
| `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py generate --root . --out dev-docs/active/guidance-recall-and-observability/artifacts/env/04-context-refresh.md` | pass |
| `node .ai/tests/run.mjs --suite environment` | pass |

## Scenario checklist
- [x] bell 通知点击能落到正确 deep link
- [x] 同一 canonical item 不会在 bell / inbox / proactive 产生重复卡
- [x] fatigue / cooldown 能抑制重复 reason code 轰炸
- [x] `USE_FOLLOWING_FEED`、ready receipt、未启动 owner loop 都有延迟回流验证
- [x] 新用户前 3 次召回保持 teaching-first 且单次只有一个强 CTA
- [x] 匿名 actor 不会收到需要登录才能完成的 CTA
- [x] admin 侧能看到 guidance flags、未读数和 reason 漏斗

## Evidence
- env contract validation: `dev-docs/active/guidance-recall-and-observability/artifacts/env/03-validation-log.md`
- env contract generation: `dev-docs/active/guidance-recall-and-observability/artifacts/env/04-context-refresh.md`
