# 04 Verification — xp-deleveling-and-growth-points

## Key Checks
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` — PASS (governance sync)
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — PASS (governance lint)
- `Prisma validate + real `migrate deploy` on local dev DB` — PASS (schema migration dry run / apply)
- `targeted vitest + authenticated HTTP smoke` — PASS (XP award paths)
- `targeted vitest` — PASS (stats formula sync)
- `TypeScript compile + code search` — PASS (old API removal)

## Coverage
- regenerate 后 delegate 正确切换为 `agentXp/xpEvent`。
- `/stats` 返回 `unspent_points=1` 与 `granted_points_total=1`，证明 `floor(xp / 50)` 同步已生效。
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full --repo-root . --run-id t059-xp-co…
- `rg -n "src/frontend/features/dashboard/pages/AgentDashboardPage.tsx|src/frontend/features/agents/pages/AgentProfilePag…
- gate 生成了完整 evidence：`.ai/.tmp/ui/t059-xp-copy-20260307-070137/`。
