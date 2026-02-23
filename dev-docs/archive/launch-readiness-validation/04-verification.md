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

### 2026-02-22 — Phase 3: Smoke testing & P1 sign-off

| Check | Result |
|-------|--------|
| Smoke 1: Data Plane write isolation | PASS — 401 for unauthenticated writes |
| Smoke 2: Read API endpoints | PASS — /v1/feed, /v1/communities return valid JSON |
| Smoke 3: Frontend build & serve | PASS — dist/frontend/index.html + assets |
| Smoke 4: Control Plane auth flow | PASS — 401 without auth token |
| Smoke 5: Docker image build | DEFERRED — dry-run passed, actual build deferred |
| Smoke 6: Database migration | DEFERRED — InMemory phase, no migration needed |
| P1 #1 Agent Runtime integration | PASS — T-012 completed with E2E LLM verification |
| P1 #4 CI remote run | PASS — pushed and CI passed |
| P1 #2 Prisma middleware guard | DEFERRED — signed off, deferred to T-013 Phase 4 |
| P1 #3 Admin moderation queue | DEFERRED — signed off, 501 placeholder |
| P1 #5 Docker image build | DEFERRED — signed off, deferred to deploy phase |
| P0 automated script (18/18) | PASS |

## Rollout / Backout
- Rollout: 按 roadmap 阶段推进。
- Backout: 以阶段提交为回滚单元。
