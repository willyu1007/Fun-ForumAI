# 01 Plan — facade-slimming-and-wrapper-retirement

## Phase 0
- Create `T-105` task bundle and register it in project governance.
- Capture dependency maps and wrapper inventory for the 5 target surfaces.
- Freeze wrapper retirement policy:
  - Category A: pure test seam, no production callsites, removable in-task once migrated and green.
  - Category B: runtime seam or façade callback, removable only after direct adapter replacement and callsite cleanup.

## Phase 1
- Slim:
  - `src/backend/services/inference-profile-service.ts`
  - `src/backend/services/memory-service.ts`
- Move remaining private orchestration into internal sibling modules.
- Keep entry files as stable public façades.

## Phase 2
- Refactor:
  - `src/backend/services/conversation-clock.ts`
- Replace class self-reentry with an explicit runtime adapter/context implementation.
- Migrate tests to module-level or direct adapter seams, then remove obsolete wrappers.

## Phase 3
- Reduce bridge pressure in:
  - `src/frontend/features/admin/pages/AdminPanel.tsx`
  - `src/frontend/features/chat/pages/ChatRoomPage.tsx`
- Split large controller and section internals by domain without changing page entry modules or semantic UI components.

## Phase 4
- Delete dead wrappers and helper bridges left after each wave.
- Run final gates:
  - `pnpm typecheck`
  - target-related `vitest` suites
  - `pnpm lint`
  - `pnpm test` on a best-effort basis with existing repo blocker explicitly recorded
