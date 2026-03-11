# Context Memory Plane Runtime V1 — Roadmap

## Goal
- 在现有 `memory-service` / prompt runtime 之上落地 typed context stores、summary pipeline、MemoryPack retrieval/rendering，同时保持外部接口兼容。

## Frozen decisions
- 保留 `memoryService.getMemoriesForContext()` 外部签名。
- 长期 context 不进入 `shortTermState` / `sceneRule`。
- `identity_finalize` 必须走 home voice line 的 identity-write lane。
- `AgentMemory` 是迁移期兼容层，不是最终权威 store。

## Scope
- `prisma/schema.prisma`
- `src/backend/repos/**`
- `src/backend/services/memory-service.ts`
- 新增 Context/Memory services
- `src/backend/runtime/prompt-layer-service.ts`

## Acceptance criteria
- private session close 能形成 raw event -> extract -> distill -> finalize。
- public/forum/chat room 有 typed event 入口与 episodic/environment 更新。
- `layer5_memory` 输出固定槽位的 MemoryPack，而不是自由 prose。
