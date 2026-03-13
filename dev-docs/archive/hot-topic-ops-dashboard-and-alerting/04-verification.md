# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm exec tsc --noEmit` | pass |
| `pnpm vitest run src/backend/routes/__tests__/admin-hot-topic-api.test.ts src/backend/services/__tests__/hot-topic-policy-config.test.ts src/backend/services/__tests__/hot-topic-policy-service.test.ts src/backend/services/__tests__/policy-gateway-service.test.ts` | pass |
| `pnpm vitest run src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx` | pass |
| `pnpm exec eslint src/backend/routes/admin-api.ts src/backend/routes/__tests__/admin-hot-topic-api.test.ts src/backend/services/hot-topic-ops-service.ts src/backend/repos/post-repository.ts src/backend/repos/pg/pg-post-repository.ts src/frontend/features/admin/pages/AdminPanel.tsx src/frontend/api/hooks/admin.ts src/frontend/api/query-keys.ts src/frontend/api/types.ts` | pass |
| `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --repo-root . --run-id t087-closeout-20260313c --evidence-root .ai/.tmp/ui --mode full --fail-on errors` | pass |

## Executed verification

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm exec tsc --noEmit` | pass | 热点运营 API / UI 合并后静态编译通过 |
| `pnpm vitest run src/backend/routes/__tests__/admin-hot-topic-api.test.ts src/backend/services/__tests__/hot-topic-policy-config.test.ts src/backend/services/__tests__/hot-topic-policy-service.test.ts src/backend/services/__tests__/policy-gateway-service.test.ts` | pass | 覆盖 dashboard/alerts/control API、sampling thresholds、gray/deny override 与 sampled-review case |
| `pnpm vitest run src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx` | pass | 覆盖 hot-topic tab、告警列表、post/room control |
| `pnpm exec eslint src/backend/routes/admin-api.ts src/backend/routes/__tests__/admin-hot-topic-api.test.ts src/backend/services/hot-topic-ops-service.ts src/backend/repos/post-repository.ts src/backend/repos/pg/pg-post-repository.ts src/frontend/features/admin/pages/AdminPanel.tsx src/frontend/api/hooks/admin.ts src/frontend/api/query-keys.ts src/frontend/api/types.ts` | pass | T-093 触达文件 lint clean |
| `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --repo-root . --run-id t087-closeout-20260313c --evidence-root .ai/.tmp/ui --mode full --fail-on errors` | pass | 报告见 `.ai/.tmp/ui/t087-closeout-20260313c/ui-gate-report.md` |
