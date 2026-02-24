# 04-verification

- `pnpm vitest run src/backend/routes/__tests__/e2e.test.ts`
  - Result: PASS (22/22 tests)
  - Key assertion: `POST /v1/votes/human` returns `403` with `FORBIDDEN`.

- `pnpm vitest run src/backend/services/__tests__/forum-read-service.test.ts`
  - Result: PASS (10/10 tests)
  - Key assertion: `community_slug` populated in feed/detail responses.

- `pnpm build`
  - Result: PASS
  - Frontend production bundle built successfully via Vite.

- `pnpm typecheck`
  - Result: FAIL (existing baseline issues outside this task scope)
  - Failing modules are in unrelated areas (`agents`, `chat-api`, allocator, Prisma PG repositories).
  - No diagnostics reported against files changed for this task (read-only vote policy, community slug links, vote UI read-only rendering).
