# 02 Architecture — facade-slimming-and-wrapper-retirement

## Global retention rules
- The original entry files remain the stable public surface.
- Extracted modules remain internal to the feature/service sibling directory.
- A wrapper may only survive this task if it still carries one of:
  - runtime seam value
  - telemetry/observability seam value
  - failure isolation value
- Pure forwarding layers without those properties are deletion candidates.

## Dependency and wrapper inventory

### `InferenceProfileService`
- Incoming surface:
  - control-plane and profile read callers rely on the current class and method names
- Keep in entry:
  - constructor
  - `setXpService`
  - public read/write methods
- Move out of entry:
  - compile/evaluate orchestration
  - growth and respec lookup
  - shadow review lifecycle
  - review case synchronization

### `MemoryService`
- Incoming surface:
  - private digest generation, context retrieval, privacy settings, nightly maintenance callers rely on the current class methods
- Keep in entry:
  - constructor
  - digest hook registration
  - current public methods
- Move out of entry:
  - digest pipeline implementations
  - public observation writer and dedup helpers
  - privacy policy resolution helpers
  - run recording and identity lookup
  - nightly maintenance implementation

### `ConversationClock`
- Incoming surface:
  - public lifecycle methods and setter methods remain stable
- Current problem:
  - `tick-runner` and `program-tick` call back into the class through `context.scheduleAgent` and `context.generateMessage`, which keeps runtime coupled to class wrappers
- Target shape:
  - `getContext()` returns a direct adapter object with concrete implementations instead of class wrapper bounce-backs
  - tests target module seams or the adapter object, not private class methods

### `AdminPanel`
- Keep:
  - page shell
  - semantic governance/hot-topic/runtime tabs
- Target split:
  - separate controller slices for governance, hot topic, and review/disclosure operations
  - section components consume narrow props, not the entire root controller object

### `ChatRoomPage`
- Keep:
  - page shell
  - semantic UI components such as header, message bubble, participants sidebar, highlight strip, hot-topic notice, and storyline rail
- Target split:
  - controller return value grouped into room/viewer/reporting/director/presentation domains
  - `DirectorPanel` split by tab/form state to avoid a second monolith

## Verification strategy
- Verify after each wave with focused suites before moving to the next wave.
- Wrapper deletion gate:
  - `rg` for retired wrapper names must not match tests or the façade file anymore
  - remaining matches are allowed only in new internal modules or task docs
- Final repo-wide `pnpm test` is best-effort because `src/backend/routes/__tests__/dev-prompts-render.test.ts` is already a known out-of-scope blocker.
