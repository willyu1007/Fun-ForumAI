# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` | pass |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass |
| `pnpm exec prisma validate` | pass |
| `pnpm exec tsc -p tsconfig.app.json` | pass |

## Governance checklist
- [x] 五个任务束目录存在。
- [x] 五个 `.ai-task.yaml` 合法且 task id 不冲突。
- [x] registry 中 `M-010 / F-050 / R-050~R-053 / T-087~T-091` 映射已补齐。
- [x] schema / migration 证据目录已建立。
- [x] code implementation 验证记录已补充。

## Executed verification

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | pass-with-warning | `dtrace-provider` 拉 Node headers 时 `ECONNRESET`，但安装最终成功 |
| `pnpm db:validate` | pass | Prisma schema valid |
| `pnpm test src/backend/services/__tests__/policy-gateway-service.test.ts src/backend/services/__tests__/identity-gate-service.test.ts src/backend/services/__tests__/complaint-appeal-service.test.ts src/backend/services/__tests__/agent-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts` | pass | 49 tests passed |
| `pnpm test src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx` | pass | 10 tests passed |
| `pnpm typecheck` | pass | includes `prisma generate` pre-step |
| `pnpm test src/backend/services/__tests__/policy-gateway-service.test.ts src/backend/services/__tests__/complaint-appeal-service.test.ts src/backend/services/__tests__/agent-service.test.ts src/backend/routes/__tests__/admin-api-utils.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-control-plane.test.ts` | pass | 95 tests passed after fixing review findings |
| `pnpm vitest run src/backend/services/__tests__/agent-config-lint-service.test.ts src/backend/services/__tests__/complaint-appeal-service.test.ts src/backend/services/__tests__/forum-write-service.policy-gateway.test.ts src/backend/services/__tests__/chat-service.policy-gateway.test.ts src/backend/services/__tests__/private-channel-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/services/__tests__/policy-gateway-service.test.ts src/backend/routes/__tests__/private-channel-message-auth.test.ts src/backend/routes/__tests__/private-channel-memory-auth.test.ts` | pass | 48 tests passed, 覆盖 config diff lint、>200 report dedupe、forum/chat target rebind、私聊读取 owner auth |
| `pnpm exec tsc --noEmit` | pass | 新增治理仓储接口与调用点通过静态编译 |
| `git diff --check` | pass | no whitespace / merge-marker issues |
| `node .ai/scripts/ctl-db-ssot.mjs sync-to-context` | pass | refreshed `docs/context/db/schema.json` after schema change |

## DB apply status
- Repo changed: yes
- Migration file created: `prisma/migrations/20260312123000_t087_mainland_launch_safety_governance/migration.sql`
- Migration applied to a real DB: no
- Reason: 本轮只实现 repo / schema / migration 文件与本地静态验证，未执行任何对真实数据库的写入操作。
