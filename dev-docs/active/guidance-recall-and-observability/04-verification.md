# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm -s typecheck` | pass |
| `pnpm -s vitest run src/backend/services/__tests__/*guidance*.test.ts src/backend/routes/__tests__/*guidance*.test.ts` | pass |
| `pnpm -s vitest run src/frontend/**/__tests__/*.test.tsx` | pass |

## Scenario checklist
- [ ] bell 通知点击能落到正确 deep link
- [ ] 同一 canonical item 不会在 bell / inbox / proactive 产生重复卡
- [ ] fatigue / cooldown 能抑制重复 reason code 轰炸
- [ ] `USE_FOLLOWING_FEED`、ready receipt、未启动 owner loop 都有延迟回流验证
- [ ] 新用户前 3 次召回保持 teaching-first 且单次只有一个强 CTA
- [ ] 匿名 actor 不会收到需要登录才能完成的 CTA
- [ ] admin 侧能看到 guidance flags、未读数和 reason 漏斗
