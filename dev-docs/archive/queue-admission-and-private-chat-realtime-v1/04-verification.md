# 04 Verification

## 2026-04-06

- Task initialized; verification to be appended after each phase.
- Targeted regression after the async private-chat cutover:
  - `pnpm exec vitest run src/backend/services/__tests__/private-channel-service.test.ts src/frontend/features/agents/components/modal/__tests__/TabChat.test.tsx src/frontend/api/hooks/__tests__/private-chat.test.tsx`
  - Result: passed, `25/25` tests.
- Wider regression across the touched queue/gateway/private-chat surfaces:
  - `pnpm exec vitest run src/backend/llm/__tests__/credential-broker.test.ts src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/registry-contract.test.ts src/backend/llm/__tests__/callsite-inventory.test.ts src/backend/media/__tests__/media-generation-service.test.ts src/backend/runtime/__tests__/post-scheduler.test.ts src/backend/services/__tests__/private-channel-service.test.ts src/frontend/features/agents/components/modal/__tests__/TabChat.test.tsx src/frontend/api/hooks/__tests__/private-chat.test.tsx`
  - Result: passed, `87/87` tests.
- Static verification:
  - `pnpm exec prisma format`
  - `pnpm exec prisma generate`
  - `pnpm exec tsc --noEmit`
  - `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
  - `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs`
  - `git diff --check`
  - Result: all passed.
- Live kind deployment:
  - `pnpm k8s:staging:local -- --k8s-context kind-funforum`
  - backend rollout completed on `kind-funforum`; health probe at `http://127.0.0.1:4000/v1/health` returned `200`.
- Live private-chat concurrency verification against kind:
  - Auth: dev bearer token for `dev-user-001`.
  - Agents: `洛芙蕾丝`, `苏格拉底-7B`, `辩论大师`, `俳句师`.
  - Four concurrent session sends returned `200` immediately with `agent_reply.runtime_status=THINKING`.
  - Duplicate send on the same session returned `409 PRIVATE_REPLY_IN_PROGRESS`.
  - Ack latency dropped from the earlier `~3.3s` range to `397-416ms` for text-only sends after moving prompt preparation into the detached completion task.
  - All four replies converged to `READY`; no `RegistryResolutionError` remained after clamping private chat to base-tier routing.
- Live admission evidence:
  - backend `LlmUsageLedger` recorded private-chat traffic using both `dashscope-primary` and `dashscope-secondary`.
  - This confirmed that the new admission layer can protect the cost-first primary pool and spill private chat to the higher-concurrency secondary pool under contention.
- Live browser verification with Chrome DevTools:
  - switched dev identity to `user`.
  - opened the owner agent modal and entered the private chat tab.
  - sent a new message through the real composer.
  - observed:
    - the composer disabled immediately after send, showing the pending lockout state
    - the human message appeared immediately
    - the final agent reply rendered back into the same timeline
  - This matches the intended ack-first + async completion contract.
- Live scheduled-post / media verification:
  - `POST /v1/dev/runtime/post` returned `triggered=true` with `post_id=c58475ce-21c5-4dcb-8641-8a11a6c1ccbb`.
  - runtime stats confirmed the post counted toward the scheduler budget.
  - database verification confirmed `post_media` bound the post to generated asset `cmnn8pqs106ki0mmtoh7b2jq4` with `source_kind=generated`.
  - backend logs showed the scheduled post completed without new media queue transaction-timeout errors.
- Known tradeoff observed during live verification:
  - hidden/background digests can fast-fail with `RateLimitError` while bounded visible pools are saturated.
  - This is acceptable for the current task because it preserves private chat latency and correctness, but background QoS shaping should be handled in a follow-up task.

## 2026-04-07

- Cleanup/fix verification after closing the remaining reliability and drift gaps:
  - `pnpm exec vitest run src/backend/services/__tests__/private-channel-service.test.ts src/backend/runtime/__tests__/private-channel-scheduler.test.ts src/backend/llm/__tests__/runtime-override-state.test.ts src/backend/llm/__tests__/callsite-inventory.test.ts`
  - Result: passed, `23/23` tests.
- Broader regression after collapsing the private-reply policy to a single profile-owned execution policy and adding stale placeholder recovery:
  - `pnpm exec vitest run src/backend/llm/__tests__/credential-broker.test.ts src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/registry-contract.test.ts src/backend/llm/__tests__/callsite-inventory.test.ts src/backend/media/__tests__/media-generation-service.test.ts src/backend/runtime/__tests__/post-scheduler.test.ts src/backend/runtime/__tests__/private-channel-scheduler.test.ts src/backend/services/__tests__/private-channel-service.test.ts src/frontend/features/agents/components/modal/__tests__/TabChat.test.tsx src/frontend/api/hooks/__tests__/private-chat.test.tsx`
  - Result: passed, `90/90` tests.
- Schema/runtime/static verification:
  - `pnpm exec prisma format`
  - `pnpm exec prisma generate`
  - `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
  - `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs`
  - `pnpm exec tsc --noEmit`
  - `git diff --check`
  - Result: all passed.
