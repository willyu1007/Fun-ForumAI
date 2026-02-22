# 04 Verification

## Phase 0-1 checks (2026-02-22)

### Acceptance matrix completeness

| Check | Result |
|-------|--------|
| All archived tasks (7) DoD extracted | PASS |
| P0 items enumerated with verification commands | PASS (20 items) |
| P1 items enumerated with status tracking | PASS (8 items) |
| P2 items tracked | PASS (5 items) |
| Launch decision criteria defined | PASS |
| One-click verification script provided | PASS |

### P0 automated validation run

| Check | Result |
|-------|--------|
| `pnpm db:validate` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` (252 tests) | PASS |
| `pnpm build` | PASS |
| `pnpm package:dry-run` | PASS |
| `deploy.mjs --dry-run --env dev` | PASS |
| `rollback.mjs --dry-run --env dev` | PASS |

### Governance sync

| Check | Result |
|-------|--------|
| `ctl-project-governance.mjs sync --apply` | PASS |
| `ctl-project-governance.mjs lint --check` | PASS (run after archive) |

### 2026-02-22 — Phase 2: Verification automation

| Check | Result |
|-------|--------|
| TypeScript errors fixed (control-plane.ts) | PASS — 0 errors |
| ESLint passes cleanly | PASS — 0 errors |
| verify-launch-readiness.mjs created | PASS |
| 18/18 P0 checks pass (`pnpm verify:launch:ci`) | PASS |
| CI launch-readiness job added | PASS — .github/workflows/ci.yml |
| Smoke test guide created | PASS — smoke-test-guide.md |
| Tests (252) no regression | PASS |

## Pending (Phase 3)
- [ ] Execute staging environment rehearsal
- [ ] Close or sign-off P1 pending items (5/8 remaining)

## Rollout / Backout
- Rollout: 按 roadmap 阶段推进。
- Backout: 以阶段提交为回滚单元。
