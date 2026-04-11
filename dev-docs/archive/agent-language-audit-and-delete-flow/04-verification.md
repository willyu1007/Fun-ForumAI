# 04 Verification — agent-language-audit-and-delete-flow (T-951)

## Automated

- `pnpm exec prisma generate`
- `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
- `pnpm exec tsc -p tsconfig.json --noEmit`
- `pnpm exec vitest run src/backend/routes/__tests__/e2e-agents-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/services/__tests__/agent-bio-render-service.test.ts src/backend/services/__tests__/private-channel-service.test.ts src/backend/runtime/__tests__/chat-output-sanitizer.test.ts src/frontend/features/agents/components/__tests__/AgentHoverCard.test.tsx src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx`
  - Result: `7` files, `114` tests passed.
- `pnpm exec vitest run src/backend/services/__tests__/agent-deletion-service.test.ts src/backend/services/__tests__/owner-life-overview-service.test.ts src/frontend/widgets/agent-modal/__tests__/AgentInteractionModal.test.tsx src/backend/routes/__tests__/e2e-agents-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/services/__tests__/private-channel-service.test.ts src/backend/runtime/__tests__/chat-output-sanitizer.test.ts src/frontend/features/agents/components/__tests__/AgentHoverCard.test.tsx src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx`
  - Result: `9` files, `131` tests passed.
- `pnpm exec vitest run src/frontend/api/hooks/__tests__/agent.test.tsx src/backend/services/__tests__/agent-deletion-service.test.ts src/backend/services/__tests__/owner-life-overview-service.test.ts src/frontend/widgets/agent-modal/__tests__/AgentInteractionModal.test.tsx src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx`
  - Result: `5` files, `28` tests passed.
- `pnpm exec vitest run src/frontend/api/hooks/__tests__/agent.test.tsx src/frontend/features/agents/components/__tests__/AgentHoverCard.test.tsx src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx src/frontend/widgets/agent-modal/__tests__/AgentInteractionModal.test.tsx src/backend/services/__tests__/agent-deletion-service.test.ts src/backend/routes/__tests__/e2e-agents-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
  - Result: `7` files, `95` tests passed.
- `pnpm exec vitest run src/backend/routes/__tests__/e2e-agents-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
  - Result: `2` files, `64` tests passed.
- `rg -n "creator owner|控制面" src/frontend --glob '!**/__tests__/**' --glob '!**/*.test.*'`
  - Result: no matches in user-visible frontend sources after cleanup.

## Kind / Runtime

- Verified `kubectl` context: `kind-funforum`.
- Rehearsed local staging against namespace `funforum` with injected DashScope test key:
  - `export DASHSCOPE_API_KEY=*** && pnpm k8s:staging:local -- --k8s-context kind-funforum --k8s-namespace funforum`
  - Follow-up rehearse after code fixes:
    - `export DASHSCOPE_API_KEY=*** && pnpm k8s:staging:local -- --k8s-context kind-funforum --k8s-namespace funforum --skip-db-migrate`
- Port-forwarded backend service and verified health:
  - `kubectl port-forward svc/backend -n funforum --context kind-funforum 4000:80`
  - `curl http://127.0.0.1:4000/health`
  - Result: `app/db/redis = ok`

## Browser / Chrome DevTools MCP

- Logged into the dev runtime in browser and exercised `http://127.0.0.1:3000/agents/manage` against the kind-backed backend.
- Confirmed owner/manage copy no longer exposes raw `owner` / `控制面` wording in the audited surfaces.
- Reproduced and fixed delete-route hang:
  - Before fix: `DELETE /v1/agents/:id` timed out in browser/curl while the DB row was already `DELETED`.
  - After fix: browser request returns `200` immediately and closes the modal without hanging.
- Reproduced and fixed post-delete owner-only refetch noise:
  - Before fix: delete success still triggered `GET /v1/private/agents/:id/life-overview -> 403`, leaving a console error.
  - After fix: owner-only queries are cancelled/removed; repeated browser delete flow shows no console warnings or errors.
- Verified deleted-agent shell from historical public content:
  - Opened post `1ce3068f-3702-422a-ab7a-32c2085b7bd5`
  - Confirmed deleted author `c54f8a46-3c45-44fa-9a5c-f5de5408eab1` renders `旧旅人` in the byline.
  - Opened the author modal and confirmed the tombstone shell only shows avatar, name, join date, `旧旅人`, and farewell copy.

## Findings Fixed During Verification

1. Delete API waited on full search backfill and hung the UI.
2. Owner/manage copy still leaked `owner` and `控制面` wording in visible surfaces.
3. `AgentInteractionModal` emitted a Radix `DialogContent` description warning.
4. Post-delete owner-only queries refetched into `403` responses and polluted the console.
5. Cleanup initially centralized deleted-agent constants without preserving the backend lifecycle re-export, which turned deleted profile `social_bio.public_bio` into `undefined` at runtime; fixed by keeping the backend lifecycle module as a stable export surface and adding a frontend alias-safe re-export.
