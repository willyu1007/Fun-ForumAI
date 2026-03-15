# 03 Implementation Notes — architecture-decomposition-eight-priority-files

## Phase 0
- Task bundle created for `T-104`.
- Umbrella scope is fixed to 8 primary files with blocking-spillover allowance only.

## Phase 1
- `InferenceProfileService` was reduced to a façade over:
  - `compile.ts`
  - `shadow-review.ts`
  - `route-resolution.ts`
  - `codec.ts`
- Shadow review collection kept the original entrypoints and now anchors evidence windows to `profile.shadowStartedAt`, so evidence gathered during the live shadow window is not dropped when review collection starts later.
- `MemoryService` was decomposed into:
  - `digest.ts`
  - `retrieval.ts`
  - `typed-context.ts`
  - `maintenance.ts`
- `ReviewService` was decomposed into:
  - `case-lifecycle.ts`
  - `task-assignment.ts`
  - `linked-request-sync.ts`
  - `evidence-export.ts`
  - `notification-copy.ts`
- `ForumWriteService` was decomposed into:
  - `stage-gates.ts`
  - `moderation-pipeline.ts`
  - `post-command.ts`
  - `comment-command.ts`
  - `scene-write.ts`
  - `vote-command.ts`
- All four original service files remain in place and preserve their export names/import paths.

## Phase 2
- `ChatService` was reduced to a façade over:
  - `membership.ts`
  - `message-pipeline.ts`
  - `read-model.ts`
  - `projection-broadcast.ts`
- `ConversationClock` was reduced to orchestration/timer lifecycle over:
  - `constants.ts`
  - `types.ts`
  - `prompt-context.ts`
  - `message-generator.ts`
  - `program-tick.ts`
  - `tick-runner.ts`
- `ConversationClock` kept instance-level wrapper methods for `handleTick`, `generateMessage`, `scheduleAgent`, `syncActiveRoomTimers`, and related seams so existing tests and runtime call paths still route through the façade instead of bypassing it.
- Spillover: `src/backend/llm/callsite-inventory.ts` was updated because the chat-room visible generation callsite moved from `conversation-clock.ts` to `conversation-clock/message-generator.ts`.
- Spillover: `src/backend/llm/provider-admission.ts` import was corrected to use `gateway-contract.js` for `ModelProfileCandidate`.

## Phase 3
- `AdminPanel.tsx` is now a thin page shell over:
  - `use-admin-panel-controller.ts`
  - `GovernanceTab.tsx`
  - `GovernanceSections.tsx`
  - `HotTopicTab.tsx`
  - `shared.tsx`
  - `request-panels.tsx`
  - `constants.ts`
- Governance, hot-topic, case/detail, identity review, disclosure-cap, and risk-profile rendering are now separated from the page entry.
- `ChatRoomPage.tsx` is now a thin page shell over:
  - `use-chat-room-controller.ts`
  - `ChatHeader.tsx`
  - `PublicStorylineRail.tsx`
  - `HotTopicNotice.tsx`
  - `HighlightStrip.tsx`
  - `MessageBubble.tsx`
  - `ParticipantsSidebar.tsx`
  - `DirectorPanel.tsx`
  - `constants.ts`
- Frontend cleanup spillover:
  - Removed split-time unused imports.
  - Updated `AgentProfilePage.test.tsx` fixtures to match the current `Agent` / `InferenceProfileDebugData` contract instead of relying on stale partial response typing.

## Phase 4
- Full targeted verification passed for all 8 target surfaces.
- Repo-level `typecheck` and `lint` passed.
- Repo-level `test` was attempted twice. After fixing a real regression in `callsite-inventory.test.ts`, the remaining blocker is `src/backend/routes/__tests__/dev-prompts-render.test.ts`, which stalls in collection/setup (`0/8`) when run standalone and when reached from `pnpm test`. This blocker is outside the 8-file decomposition scope.
