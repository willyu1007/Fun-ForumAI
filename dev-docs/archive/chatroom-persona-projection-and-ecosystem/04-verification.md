# 04 Verification — T-075

## 2026-03-09
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog`
  - Result: pass
  - Notes: registry、dashboard、feature-map、task-index 已更新；changelog 追加 `T-075` 注册事件。
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: pass
  - Notes: 仅存在既有旧任务 warning；`T-075` 注册与 bundle 结构通过。

## 2026-03-10
- `pnpm prisma format`
  - Result: pass
  - Notes: 格式化 `prisma/schema.prisma`，确认 schema 语法收敛。
- `pnpm prisma validate`
  - Result: pass
  - Notes: Prisma schema 校验通过；本轮未执行 DB write。
- `pnpm prisma generate`
  - Result: pass
  - Notes: Prisma client 成功重生成。
- `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
  - Result: pass
  - Notes: `docs/context/db/schema.json` 与 registry 已同步。
- `pnpm exec tsc --noEmit`
  - Result: pass
  - Notes: backend/frontend 改动后的 TypeScript 编译通过。
- `pnpm vitest run src/backend/routes/__tests__/chat-watchability-api.test.ts src/backend/routes/__tests__/chatroom-control-api.test.ts src/backend/services/__tests__/chatroom-runtime-context-builder.test.ts src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx src/frontend/features/chat/hooks/__tests__/use-chat-room-sse.test.tsx`
  - Result: pass
  - Notes: 验证聊天室只读/owner control API、runtime context、页面与 SSE 刷新链路。
- `pnpm vitest run src/backend/services/__tests__/room-program-engine.test.ts src/backend/services/__tests__/room-program-projector.test.ts src/backend/services/__tests__/conversation-clock.test.ts`
  - Result: pass
  - Notes: 验证 program engine、projector 与 ecology clock 接线未回归。
- `pnpm vitest run src/backend/routes/__tests__/chat-watchability-api.test.ts src/backend/routes/__tests__/chatroom-control-api.test.ts src/backend/routes/__tests__/e2e-control-plane.test.ts src/backend/routes/__tests__/e2e-full-flow.test.ts src/backend/services/__tests__/chat-service.watchability.test.ts src/backend/services/__tests__/chat-service.room-moves.test.ts src/backend/services/__tests__/chatroom-control-service.test.ts src/backend/services/__tests__/chatroom-runtime-context-builder.test.ts src/backend/services/__tests__/conversation-clock.test.ts src/backend/services/__tests__/room-discovery-service.test.ts src/backend/services/__tests__/room-ecology-service.test.ts src/backend/services/__tests__/room-program-engine.test.ts src/backend/services/__tests__/room-program-projector.test.ts src/backend/services/__tests__/room-program-scorer.test.ts src/backend/services/__tests__/room-projector.test.ts src/frontend/features/chat/pages/__tests__/ChatRoomPages.test.tsx src/frontend/features/chat/hooks/__tests__/use-chat-room-sse.test.tsx`
  - Result: pass
  - Notes: 共 17 个文件、70 条测试通过；覆盖 owner auth、viewer gating、room move rollback、program/runtime/projector、chatroom UI/SSE，以及现有 control-plane/full-flow 端到端回归。
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
  - Result: fail (baseline)
  - Notes: 证据目录为 `.ai/.tmp/ui/20260310T033013Z-35545/`；失败原因是 repo 既有 Tailwind/data-ui 基线问题，非本 task 新增缺陷。
