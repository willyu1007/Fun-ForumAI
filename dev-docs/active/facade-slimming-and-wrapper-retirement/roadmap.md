# Roadmap — facade-slimming-and-wrapper-retirement

## Summary
- This is a follow-up umbrella task after `T-104`.
- The goal is to turn first-pass decomposition into long-term stable boundaries by slimming heavy entry files, retiring compatibility wrappers, and reducing megacontroller bridge layers.
- Original entry files and import paths remain stable; only internal wrappers and bridge layers are eligible for deletion.

## Execution Waves

### Wave 0
- Create the task bundle and register `T-105`.
- Freeze retention rules:
  - original entry files stay
  - internal wrappers are removable only after category-specific gates
  - no route, schema, or public contract rewrites

### Wave 1
- Slim backend entry façades:
  - `InferenceProfileService`
  - `MemoryService`

### Wave 2
- Retire runtime/test-driven wrappers:
  - `ConversationClock`

### Wave 3
- Reduce frontend bridge layers without re-expanding page shells:
  - `AdminPanel`
  - `ChatRoomPage`

### Wave 4
- Delete dead wrappers/helpers left behind by the refactor.
- Run final verification and record remaining non-task blockers.
