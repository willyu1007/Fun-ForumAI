# 00 Overview — facade-slimming-and-wrapper-retirement

## Status
- State: in-progress
- Next step: register `T-105`, then implement Wave 1 backend façade slimming with targeted tests before touching runtime and frontend bridge cleanup.

## Goal
- Slim the still-heavy entry files left behind by `T-104`.
- Remove compatibility wrappers that no longer provide runtime or test value.
- Preserve stable import paths and public contracts while reducing orchestration and megabag controller pressure.

## Non-goals
- Do not reopen `T-104` or expand second-tier route/repository decomposition into scope.
- Do not change Prisma schema, REST wire shape, or frontend routes.
- Do not inline page shells or delete semantic UI components only because they are small.

## Acceptance criteria
- `InferenceProfileService` and `MemoryService` entry files keep only public contract wiring and delegation, not private business workflows.
- `ConversationClock` no longer uses class-level self-reentry wrappers for runtime or tests.
- `AdminPanel` and `ChatRoomPage` keep stable page shells while controller surfaces are split by domain instead of passing a single megabag.
- Any remaining wrapper has an explicit retention reason and a concrete next deletion condition documented in task notes.
