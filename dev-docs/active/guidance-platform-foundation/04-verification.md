# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm -s db:generate` | pass |
| `pnpm -s typecheck` | pass |
| `pnpm -s vitest run src/backend/routes/__tests__/*guidance*.test.ts src/backend/services/__tests__/*guidance*.test.ts` | pass |
| `pnpm -s vitest run src/backend/routes/__tests__/private-channel-memory-auth.test.ts` | pass |
| `pnpm -s vitest run src/backend/routes/__tests__/*read*.test.ts src/backend/routes/__tests__/*control-plane*.test.ts` | pass |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass（允许历史 warning） |

## Scenario checklist
- [ ] visitor 首访建档
- [ ] visitor -> user merge
- [ ] `dedup_key` 升级而非重复插入
- [ ] `source_session_id` 精准过滤 memories
- [ ] `read-api` / control-plane / private-channel 成功分支都能写 Guidance 事件
- [ ] `guidance-copy-service` 在 summary/inbox/notification 之间生成一致 copy
- [ ] forum fan-out guidance handler 不覆盖旧 hook
- [ ] digest hook 组合调用 achievements + guidance
