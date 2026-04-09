# 04 Verification

## Planned verification

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
- task query confirming `T-946` to `T-949` registration
- doc grep proving outdated “LLM-only public participation” claims are tracked under `T-949`, not left orphaned

## 2026-04-09

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - passed; registered `T-946` to `T-949` and regenerated `.ai/project/main/registry.yaml`, `.ai/project/main/dashboard.md`, `.ai/project/main/feature-map.md`, `.ai/project/main/task-index.md`.
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - passed
- `rg -n "T-946|T-947|T-948|T-949" .ai/project/main/registry.yaml .ai/project/main/task-index.md .ai/project/main/dashboard.md .ai/project/main/feature-map.md`
  - passed; confirmed all four new task ids are registered under `F-000` and visible in derived views.
- 2026-04-10: `pnpm exec tsc --noEmit`
  - passed
- 2026-04-10: `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - passed
- 2026-04-10: `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - passed
- 2026-04-10: Gate 1 packet audit
  - `rg -n "can_receive_replies\\b" src/backend src/frontend src/shared`
    - passed; field now remains only as a compat bridge, not a mainline consumer truth.
  - `rg -n "targetThreadTurn|ctx\\.targetThreadTurn" src/backend/runtime src/frontend src/shared`
    - passed; remaining mainline matches are limited to event-target assembly and prompt-layer compatibility.
  - `rg -n "viewer/posts/.*/public-threads|viewer/threads/.*/public-turns|viewer/posts/.*/audience-messages|/posts/.*/public-threads|/threads/.*/public-turns|/posts/.*/audience-messages" src/frontend src/backend/routes src/backend/services -g'*.ts' -g'*.tsx'`
    - passed; frontend active paths only bind `/viewer/*`, while legacy public-write routes stay in backend compat wrappers/tests.
- 2026-04-10: Gate 1 regression packet
  - `pnpm exec vitest run src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/runtime/__tests__/response-parser.test.ts src/backend/runtime/__tests__/agent-executor.test.ts src/backend/runtime/__tests__/runtime-feature-metrics.test.ts src/backend/services/__tests__/thread-interaction-resolver.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
    - passed; 10 files, 119 tests
  - `pnpm exec vitest run src/backend/services/__tests__/viewer-public-write-service.test.ts src/backend/services/__tests__/forum-event-dispatcher.test.ts src/backend/allocator/__tests__/admission.test.ts src/backend/runtime/__tests__/event-bridge.test.ts`
    - passed; 4 files, 25 tests
  - `pnpm exec vitest run src/backend/routes/__tests__/e2e-read-api.test.ts -t "(POST /v1/posts/:postId/public-threads and /v1/threads/:threadId/public-turns allow human open_reply on the main thread|POST /v1/viewer/posts/:postId/public-threads and /v1/viewer/threads/:threadId/public-turns return auditable envelopes and honor idempotency|POST /v1/viewer/posts/:postId/audience-messages returns auditable envelopes and honors idempotency|POST /v1/posts/:postId/audience-messages validates body length and accepts valid message|POST /v1/votes/human)"`
    - passed; 7 targeted tests
    - note: `/votes/human` remained green and is tracked separately as a Phase 1 adjacent issue, not a Gate 1 blocker.
- 2026-04-10: Gate 1 checklist
  - branch revive writes back to resolved actual anchor: PASS
  - accepted viewer write shares the same base fanout surface as agent/forum stage writes: PASS
  - lifecycle/writeability/route handoff semantics stay consistent across read/runtime/write: PASS
  - frozen semantics handed to `T-947` / `T-942` without open ambiguity: PASS
