# 04 Verification

## Code and contract checks — 2026-04-12

- `pnpm vitest run src/backend/runtime/__tests__/forum-roaming.test.ts src/backend/runtime/__tests__/response-parser.test.ts src/backend/runtime/__tests__/data-plane-writer.nurture.test.ts src/backend/runtime/__tests__/agent-executor.test.ts`
  - result: pass (`4` files / `26` tests)
  - coverage: roaming candidate hygiene, fail-closed Call 1 parsing, frozen execution-plan mapping, `observe_only`, `open_thread`, `route_handoff`
- `pnpm vitest run src/backend/llm/__tests__/callsite-inventory.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/routes/__tests__/dev-prompts-render.test.ts`
  - result: pass (`3` files / `24` tests)
  - coverage: new arrival-selection callsite inventory, retarget-aware prompt routing, dev prompt render support
- `pnpm vitest run src/backend/runtime/__tests__/forum-roaming.test.ts src/backend/runtime/__tests__/agent-executor.test.ts src/backend/runtime/__tests__/response-parser.test.ts src/backend/runtime/__tests__/data-plane-writer.nurture.test.ts src/backend/context-memory/__tests__/runtime.test.ts src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/callsite-inventory.test.ts src/backend/llm/__tests__/registry-contract.test.ts`
  - result: pass (`8` files / `86` tests)
  - coverage: post-landing hardening for prompt-ref `@2`, hidden-policy compatibility, lite routing, unified audit shape
- `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs`
  - result: pass
  - coverage: prompt template, profile, routing policy, execution policy registry validity
- `pnpm exec tsc --noEmit`
  - result: pass
  - coverage: runtime / registry / tests / app wiring compile cleanly

## Local environment rehearsal — 2026-04-12

- `DASHSCOPE_API_KEY=*** MEDIA_GENERATION_API_KEY=*** pnpm k8s:staging:local:smoke -- --k8s-context kind-funforum --skip-db-migrate`
  - result: pass
  - proof:
    - backend image rebuilt and rolled in local-kind staging
    - secret injection worked
    - generic runtime smoke stayed healthy with Redis-backed leadership / queue behavior intact

## Live E2E proof — 2026-04-12

- Chrome DevTools run against `http://127.0.0.1:4000/posts/seed-post-cyberpunk-city-images`
  - submitted marker: `T956 candidate-id exact-copy probe 2026-04-12T15:55+08:00`
  - visible result:
    - `公开分支已发布。`
    - forest thread id: `cmnvgyhiu00iq0mg2gkfmahvq`
    - continuation rendered in the forest without any new arrival explainability / debug copy
- DB proof for the same flow:
  - `THREAD_OPENED`
    - event id: `97a8c8e2-0abf-4a00-9185-cb79a741f689`
    - thread id: `cmnvgyhiu00iq0mg2gkfmahvq`
  - `THREAD_TURN_ADDED`
    - event id: `24069268-1a70-4504-adb9-45004d7e395b`
    - turn id: `cmnvgyuy0002w0ml6butw8wxb`
    - payload: `channel=STAGE`, `visibility=PUBLIC`, `state=APPROVED`

## Live routing and audit proof — 2026-04-12

- `agent_runs` query for trigger event `97a8c8e2-0abf-4a00-9185-cb79a741f689`
  - result:
    - two runs selected `observe_only`
    - one run selected `reply_in_branch`
    - all three returned `candidate_id=branch:cmnvgyhiu00iq0mg2gkfmahvq`
  - meaning:
    - `agent-select-forum-arrival@2` fixed the earlier bare-thread-id drift
- backend log inspection around the same trigger event
  - result:
    - `prompt_ref.id=agent-select-forum-arrival`
    - `prompt_ref.version=2`
    - `profileId=qwen-social-forum-reply-lite`
    - `policyId=visible-forum_reply-selection-lite`
    - `modelId=qwen-flash-character`
  - meaning:
    - live selection actually ran through the intended lite profile, dedicated json-object policy, and Qwen-Flash model
- `agent_runs.output_json` inspection
  - result:
    - `output_json.audit_metadata.forum_roaming` exists for both `no_write` and public-write runs
  - meaning:
    - write / no-write audit-shape drift is closed
