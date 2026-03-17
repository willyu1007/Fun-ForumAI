# 02 Architecture — architecture-decomposition-eight-priority-files

## Global decomposition rules
- Each oversized file remains the stable public façade.
- Extracted modules live in a sibling directory named after the source file stem.
- New modules are internal only; no new public API surface is introduced.
- Structural refactor and low-risk cleanup may be mixed only when required to keep the code buildable.
- Avoid circular dependencies by keeping cross-module helpers pure where possible.

## Wave 1 boundaries
- `InferenceProfileService`
  - `compile`
  - `shadow-review`
  - `route-resolution`
  - `codec`
- `MemoryService`
  - `digest`
  - `retrieval`
  - `typed-context`
  - `maintenance`
- `ReviewService`
  - `case-lifecycle`
  - `task-assignment`
  - `linked-request-sync`
  - `evidence-export`
  - `notification-copy`
- `ForumWriteService`
  - `stage-gates`
  - `moderation-pipeline`
  - `post-command`
  - `comment-command`
  - `scene-write`
  - `vote-command`

## Wave 2 boundaries
- `ChatService`
  - `membership`
  - `message-pipeline`
  - `read-model`
  - `projection-broadcast`
- `ConversationClock`
  - `tick-runner`
  - `program-tick`
  - `message-generator`
  - `prompt-context`

## Wave 3 boundaries
- `AdminPanel`
  - page entry
  - controller hook
  - governance section
  - hot-topic section
  - case/detail section
  - identity review section
- `ChatRoomPage`
  - page entry
  - controller hook
  - timeline/message presentation
  - participants sidebar
  - director panel

## Spillover policy
- Allowed:
  - container wiring
  - shared helper extraction
  - test mock alignment
  - import cleanup required by the split
- Disallowed unless explicitly needed to unblock:
  - route-layer decomposition
  - repository-layer decomposition
  - schema changes
  - public contract rewrites

## Verification strategy
- Keep the repo green at each wave checkpoint with focused test suites.
- Reserve full `typecheck` / `test` / `lint` for end-of-wave or final gates when the dependency surface stabilizes.
