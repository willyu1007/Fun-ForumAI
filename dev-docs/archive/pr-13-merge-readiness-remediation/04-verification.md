# 04 Verification — T-102

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm exec vitest run src/backend/services/__tests__/runtime-scene-state-manager.test.ts src/backend/services/__tests__/chatroom-control-service.test.ts src/backend/services/__tests__/director-history-shared.test.ts` | partial | 初次运行前因未生成 Prisma client 失败；`db:generate` 后通过。 |
| `pnpm exec vitest run src/backend/routes/__tests__/stage-template-scripts.test.ts src/backend/services/__tests__/public-scene-selector-service.test.ts src/backend/services/__tests__/forum-scene-continuity-service.test.ts` | pass | 审查相关回归测试通过。 |
| `pnpm exec vitest run src/backend/services/__tests__/room-program-projector.test.ts` | pass | chatroom payload redaction / raw event 继承链通过。 |
| `pnpm typecheck` | fail | 初始状态存在本 PR 引入的 compile blockers，待 remediation。 |
| `pnpm typecheck` | pass | remediation 后 `tsc -b` 通过。 |
| `pnpm exec vitest run src/backend/services/__tests__/room-program-engine.test.ts src/backend/services/__tests__/runtime-scene-state-manager.test.ts src/backend/services/__tests__/chatroom-control-service.test.ts src/backend/services/__tests__/chatroom-local-intent-service.test.ts src/backend/services/__tests__/room-program-projector.test.ts src/backend/services/__tests__/director-history-shared.test.ts` | pass | runtime / local-intent / history helper 共 22 tests 通过。 |
| `pnpm exec vitest run src/backend/services/__tests__/public-scene-selector-service.test.ts src/backend/services/__tests__/forum-scene-continuity-service.test.ts src/backend/stage/__tests__/public-director-contract.test.ts src/backend/stage/__tests__/stage-template-ops.test.ts src/backend/routes/__tests__/stage-template-scripts.test.ts src/backend/repos/__tests__/public-scene-write-repository.test.ts src/backend/repos/__tests__/pg-room-watchability-repository.test.ts` | pass | selector / stage contract / repo 映射共 27 tests 通过。 |
| `pnpm lint` | pass | `eslint src/` 通过。 |
| `pnpm exec vitest run src/backend/services/__tests__/room-program-engine.test.ts src/backend/services/__tests__/chatroom-local-intent-service.test.ts src/backend/services/__tests__/director-history-shared.test.ts src/backend/stage/__tests__/public-director-contract.test.ts src/backend/repos/__tests__/public-scene-write-repository.test.ts` | pass | 最终状态快速复验，共 19 tests 通过。 |
