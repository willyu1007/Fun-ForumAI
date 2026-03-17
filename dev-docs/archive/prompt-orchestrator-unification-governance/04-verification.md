# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm -s typecheck` | pass |
| `pnpm -s vitest run src/backend/runtime/__tests__/prompt-layer-service.test.ts src/backend/runtime/__tests__/context-builder.layer-stack-v2.test.ts` | pass |
| `pnpm -s vitest run src/backend/services/__tests__/private-channel-service*.test.ts src/backend/services/__tests__/proactive-interaction-service*.test.ts` | pass |
| `pnpm -s vitest run src/backend/routes/__tests__/dev-prompts-render.test.ts src/backend/routes/__tests__/e2e.test.ts` | pass |
| `pnpm -s test` | pass |
| `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out .ai/.tmp/env-contract/t046/03-validation-log.md` | fail（基线环境缺失必填变量，非本任务引入） |
| `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py generate --root . --out .ai/.tmp/env-contract/t046/04-context-refresh.md` | fail（依赖 validate 通过） |
| `node .ai/tests/run.mjs --suite environment` | pass |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass（允许历史 warning） |

## Scenario snapshot checklist
- [x] forum_post
- [x] forum_comment
- [x] chat_room
- [x] private_chat
- [x] proactive_dm
- [x] scheduled_post

## Execution log

| Time | Command | Result |
| --- | --- | --- |
| 2026-02-28 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass |
| 2026-02-28 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass（含历史 warning，不阻断） |
| 2026-03-01 | `pnpm -s typecheck` | pass |
| 2026-03-01 | `pnpm -s vitest run src/backend/runtime/__tests__/prompt-layer-service.test.ts src/backend/runtime/__tests__/context-builder.layer-stack-v2.test.ts` | pass |
| 2026-03-01 | `pnpm -s vitest run src/backend/routes/__tests__/dev-prompts-render.test.ts src/backend/routes/__tests__/e2e.test.ts` | pass |
| 2026-03-01 | `pnpm -s test` | pass（52 files / 367 tests） |
| 2026-03-01 | `pnpm -s lint` | pass（0 error） |
| 2026-03-01 | `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out .ai/.tmp/env-contract/t046/03-validation-log.md` | fail（`env/values/*` 缺失 `JWT_SECRET/SERVICE_AUTH_SECRET/LLM_API_KEY`） |
| 2026-03-01 | `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py generate --root . --out .ai/.tmp/env-contract/t046/04-context-refresh.md` | fail（同上） |
| 2026-03-01 | `node .ai/tests/run.mjs --suite environment` | pass |
| 2026-03-01 | `pnpm -s typecheck` | pass（orchestrator 开关语义修正后复测） |
| 2026-03-01 | `pnpm -s vitest run src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/runtime/__tests__/context-builder.layer-stack-v2.test.ts src/backend/services/__tests__/private-channel-service.test.ts src/backend/services/__tests__/proactive-interaction-service.test.ts src/backend/routes/__tests__/dev-prompts-render.test.ts` | pass |
| 2026-03-01 | `pnpm -s lint` | pass（0 error） |
| 2026-03-01 | `pnpm -s test` | pass（52 files / 367 tests，复测） |
| 2026-03-01 | `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out .ai/.tmp/env-contract/t046/03-validation-log.md` | pass（env baseline gap 已补齐） |
| 2026-03-01 | `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py generate --root . --out .ai/.tmp/env-contract/t046/04-context-refresh.md` | pass |
| 2026-03-01 | `node .ai/tests/run.mjs --suite environment` | pass |

## Real LLM suite (local dev)

### Execution constraints
- Session-only env injection (`export ...`), no API key persisted to tracked files.
- Real model calls always use explicit `model` (no `model=default`).
- Budget guardrails: flash main suite + 3 plus samples, stop thresholds kept at `CNY 8/10`.

### Command
- `pnpm tsx .ai/.tmp/t046-real-llm/run-local-real-llm.mjs`

### Artifacts
- `.ai/.tmp/t046-real-llm/local-real-llm-report.json`
- `.ai/.tmp/t046-real-llm/local-real-llm-report.md`

### Result summary (2026-03-01)
- overall pass: `true`
- phase1 provider smoke: pass (`/models=200`, `qwen-flash=200`, `qwen-plus=200`, `model=default -> 404 model_not_found`)
- phase2 six-scene render+completion: pass (`forum_post/forum_comment/chat_room/private_chat/proactive_dm/scheduled_post`)
- phase3 real workflow: pass (`scheduled_post.triggered=true`, private chat reply with `token_cost>0`, proactive dm session+message created)
- phase4 plus sampling: pass (`forum_comment/private_chat/proactive_dm`)
- phase5 staging: blocked (missing `STAGING_BASE_URL` / `STAGING_BEARER_TOKEN`)
- estimated cost: `CNY 0.002392` (below stop budget)

### TC coverage map (plan -> evidence)
- `TC-01/TC-02/TC-06/TC-07/TC-08`: covered by real LLM suite report.
- `TC-03/TC-04/TC-05/TC-10`: covered by automated tests (`prompt-orchestrator.test.ts`, `context-builder.layer-stack-v2.test.ts`).
- `TC-09`: covered by real suite redaction checks + dev render audit response assertions (`dev-prompts-render.test.ts`).

## Local Kube rehearsal (kind-funforum)

### Goal
- Validate a staging-like deployment path on local k8s after fixing image/runtime baseline gaps.

### Baseline fixes applied before final run
- Runtime image startup fix: avoid runtime `npx` install by global `tsx` install and direct `CMD ["tsx", ...]`.
- Runtime dependency fix: move `multer` to production dependencies (backend route imports at runtime).
- Cluster DB schema fix: run `prisma migrate deploy` against kind postgres.
- Local dual-leader mitigation for rehearsal: backend scaled to `replicas=1`.
- Seed/cache isolation fix in rehearsal runner: no `/v1/dev/seed`, explicit test-user upsert, agent isolation before force-post.

### Command
- `node .ai/.tmp/t046-real-llm/run-kind-kube-rehearsal.mjs` (with `kubectl port-forward` to `svc/backend`)

### Artifacts
- `.ai/.tmp/t046-real-llm/run-kind-kube-rehearsal.mjs`
- `.ai/.tmp/t046-real-llm/kind-kube-rehearsal-report.json`
- `.ai/.tmp/t046-real-llm/kind-kube-rehearsal-report.md`
- Cleanup note: temporary rehearsal artifacts under `.ai/.tmp/t046-real-llm/` were removed after verification; this document keeps the durable summary.

### Final run result (2026-03-01)
- overall pass: `true`
- phase0 health/auth: pass (`/health=200`, `/v1/auth/me=200`)
- phase1 provider smoke: pass (`/models=200`, `qwen-flash=200`, `qwen-plus=200`, `model=default -> 404`)
- phase2 six-scene render+completion: pass
- phase3 workflow chain: pass (`scheduled_post` with `post_id`, `private_chat` reply, `proactive_dm` session)
- phase4 plus sampling: pass (`forum_comment/private_chat/proactive_dm`)
- estimated cost: `CNY 0.002559`

## Staging execution constraint record

### Current status
- Real staging regression is **not executable from local-only context**.
- Blocking conditions:
  - missing `STAGING_BASE_URL`
  - missing `STAGING_BEARER_TOKEN`
  - only local kube context available (`kind-funforum`), no staging kube context in current shell.

### Decision
- Use local kind rehearsal as staging-like evidence for this round.
- Defer real staging Phase 5 until staging access variables are provided.
