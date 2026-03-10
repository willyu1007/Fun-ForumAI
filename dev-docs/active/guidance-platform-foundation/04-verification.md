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
- [x] visitor 首访建档
- [x] visitor -> user merge
- [x] `dedup_key` 升级而非重复插入
- [x] `source_session_id` 精准过滤 memories（contract 已接入 route + repo）
- [x] `read-api` / control-plane / private-channel 成功分支都能写 Guidance 事件
- [x] backend flag 关闭时，summary/inbox/client-event/action 都保持 safe no-op
- [x] frontend flag 关闭时，首页 / layout / inbox 不再渲染 guidance surface
- [x] frontend flag 关闭时，item action hook 不再发 guidance 请求
- [x] `guidance-copy-service` 在 summary/inbox/notification 之间生成一致 copy
- [x] forum fan-out guidance handler 不覆盖旧 hook
- [x] digest hook 组合调用 achievements + guidance
- [x] `GUIDANCE_UPDATED` 仅对当前 actor 连接可见
- [x] non-public / non-readable forum content 不生成 public-effect guidance
- [x] `FF_GUIDANCE_V1=false` 时不建立 guidance actor SSE 订阅，digest / fan-out helper 不触发 side effect

## Execution log
- 2026-03-10 | `pnpm db:generate` | pass
- 2026-03-10 | `pnpm exec vitest run src/backend/services/__tests__/guidance-orchestrator.test.ts src/backend/routes/__tests__/guidance-api.test.ts` | pass
- 2026-03-10 | `pnpm exec vitest run src/backend/routes/__tests__/private-channel-memory-auth.test.ts` | pass
- 2026-03-10 | `pnpm exec vitest run src/backend/services/__tests__/guidance-orchestrator.test.ts src/backend/routes/__tests__/guidance-api.test.ts src/backend/sse/__tests__/hub.test.ts` | pass
- 2026-03-10 | `pnpm typecheck` | fail（与本次 guidance 无关的既有错误仍存在：`pg-room-watchability-repository.ts`、`pg-agent-public-projection-repository.ts`、若干 room-* tests）
- 2026-03-10 | `pnpm exec vitest run src/backend/services/__tests__/conversation-clock.test.ts src/backend/services/__tests__/room-cue-planner.test.ts src/backend/services/__tests__/room-program-engine.test.ts src/backend/services/__tests__/room-program-scorer.test.ts src/backend/services/__tests__/room-projector.test.ts` | pass
- 2026-03-10 | `pnpm typecheck` | pass
- 2026-03-10 | `node -e "const fs=require('fs'); for (const p of ['node_modules/.tmp/tsconfig.app.tsbuildinfo','node_modules/.tmp/tsconfig.node.tsbuildinfo']) { try { fs.unlinkSync(p) } catch {} }"` | pass
- 2026-03-10 | `pnpm exec vitest run src/backend/services/__tests__/guidance-orchestrator.test.ts src/backend/routes/__tests__/guidance-api.test.ts src/backend/routes/__tests__/private-channel-memory-auth.test.ts src/backend/sse/__tests__/hub.test.ts src/backend/repos/__tests__/pg-memory-repository.test.ts` | pass
- 2026-03-10 | `pnpm typecheck` | pass
- 2026-03-10 | `pnpm exec vitest run src/backend/services/__tests__/guidance-orchestrator.test.ts src/backend/routes/__tests__/guidance-api.test.ts src/backend/routes/__tests__/private-channel-memory-auth.test.ts src/backend/sse/__tests__/hub.test.ts src/backend/repos/__tests__/pg-memory-repository.test.ts src/frontend/features/forum/pages/__tests__/FeedPage.test.tsx src/frontend/features/guidance/pages/__tests__/InboxPage.test.tsx src/frontend/shared/components/__tests__/Layout.test.tsx` | pass
- 2026-03-10 | `pnpm typecheck` | pass
- 2026-03-10 | `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out dev-docs/active/guidance-platform-foundation/artifacts/env/guidance-flags/03-validation-log.md` | pass
- 2026-03-10 | `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py generate --root . --out dev-docs/active/guidance-platform-foundation/artifacts/env/guidance-flags/04-context-refresh.md` | pass
- 2026-03-10 | `node .ai/tests/run.mjs --suite environment` | pass
- 2026-03-10 | `pnpm exec vitest run src/frontend/api/hooks/__tests__/guidance.test.tsx src/backend/guidance/__tests__/feature-gates.test.ts src/backend/routes/__tests__/sse.test.ts src/backend/routes/__tests__/guidance-api.test.ts src/frontend/features/guidance/pages/__tests__/InboxPage.test.tsx src/frontend/shared/components/__tests__/Layout.test.tsx src/frontend/features/forum/pages/__tests__/FeedPage.test.tsx` | pass
- 2026-03-10 | `pnpm typecheck` | pass
