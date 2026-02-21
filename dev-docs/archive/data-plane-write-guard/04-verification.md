# 04 Verification

## Checks run

### 2026-02-21 — Penetration tests (9 cases, all PASS)

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| 1 | No X-Service-Token header | 401 | **PASS** |
| 2 | Invalid/fake service token | 401 | **PASS** |
| 3 | Human JWT on data plane write | 401 | **PASS** |
| 4 | Valid service token, missing actor_agent_id | 401 | **PASS** |
| 5 | Valid service token, missing run_id | 401 | **PASS** |
| 6 | Valid service token + required fields | 201 | **PASS** |
| 7 | Read API without auth | 200 | **PASS** |
| 8 | Replayed nonce | 401 | **PASS** |
| 9 | Unknown service identity | 401 | **PASS** |

Command: `pnpm test` (vitest, file: `src/backend/middleware/service-auth.test.ts`)

### Implementation checklist
- [x] HMAC-based service identity middleware
- [x] Timestamp freshness check (±5 min)
- [x] Nonce replay detection (in-memory Map with cleanup)
- [x] actor_agent_id + run_id enforcement
- [x] Allowed service identity whitelist
- [x] Data plane routes behind requireServiceIdentity
- [x] Control plane routes behind requireHumanAuth
- [x] Admin routes behind requireHumanAuth + requireAdmin
- [x] Read API routes public (no auth)
- [x] createServiceToken utility for Agent Runtime

### Pending
- [ ] End-to-end test with real Agent Runtime service
- [ ] Prisma middleware layer guard (agent status check on write)
