# 04 Verification — T-037

1. `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
- Result: pass (warnings only from unrelated historical tasks).

2. `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
- Result: pass; T-037~T-039 registered.

3. `pnpm exec prisma generate`
- Result: pass.

4. `pnpm -s typecheck`
- Result: pass.

5. `pnpm -s test`
- Result: pass (45 files / 323 tests).

6. `pnpm db:migrate:dev --name social-graph-core`
- Result: pass; `20260227181000_social_graph_core` applied.

7. `pnpm db:migrate:status`
- Result: pass; database schema up to date.
