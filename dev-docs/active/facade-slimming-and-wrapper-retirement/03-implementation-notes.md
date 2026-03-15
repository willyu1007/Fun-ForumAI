# 03 Implementation Notes — facade-slimming-and-wrapper-retirement

## Wave 0
- Task bundle created for `T-105`.
- Follow-up scope is explicitly separated from `T-104` so first-pass decomposition and second-pass slimming have different acceptance gates.
- Wrapper retirement policy is frozen as category-based instead of “tests pass then delete everything”.

## Wave 1
- `InferenceProfileService` was reduced to a thin public contract file.
- New sibling modules now own the previously embedded orchestration:
  - `inference-profile-service/evaluation.ts`
  - `inference-profile-service/growth.ts`
  - `inference-profile-service/shadow-review-lifecycle.ts`
  - `inference-profile-service/commands.ts`
  - `inference-profile-service/types.ts`
- The entry file keeps constructor wiring, public exports, and method delegation only.
- `MemoryService` was reduced to the same shape: constructor, digest hook management, and public delegations.
- New sibling modules now own digest generation, typed context retrieval, privacy policy, public observation writes, and maintenance:
  - `memory-service/digest-pipeline.ts`
  - `memory-service/context-retrieval.ts`
  - `memory-service/public-observation.ts`
  - `memory-service/privacy-policy.ts`
  - `memory-service/maintenance-runner.ts`
  - `memory-service/constants.ts`
  - `memory-service/types.ts`
- Entry file line count after slimming:
  - `src/backend/services/inference-profile-service.ts`: 119 lines
  - `src/backend/services/memory-service.ts`: 130 lines
- This wave achieved the main acceptance gate for backend façades: the entry files no longer hold private business workflows.

## Wave 2
- `ConversationClock` was converted from a class with private self-reentry wrappers into a stable façade over an explicit runtime adapter.
- Added `conversation-clock/runtime-adapter.ts` to build the runtime context once and bind the dependency surface directly.
- Deleted class-level wrappers that existed mainly for private test seams or internal self-jumps:
  - `handleTick`
  - `scheduleAgent`
  - `scheduleAgentJoin`
  - `syncActiveRoomTimers`
  - `handleProgramTick`
  - `generateMessage`
  - `postMessage`
  - `recordGeneratedMessageRun`
- The class keeps only public lifecycle methods plus direct calls into the module layer through the bound context.
- `conversation-clock.test.ts` was migrated away from class-private casting. Tests now use an explicit harness built with the runtime adapter and exercise module seams directly.
- Entry file line count after slimming:
  - `src/backend/services/conversation-clock.ts`: 123 lines

## Wave 3
- `AdminPanel` kept its page shell but stopped passing a single flat megacontroller through the whole subtree.
- `useAdminPanelController` now returns grouped slices:
  - `auth`
  - `runtime`
  - `governance`
  - `riskProfile`
  - `disclosureCaps`
  - `review`
  - `hotTopic`
- `GovernanceTab` and `HotTopicTab` were narrowed to domain props instead of the whole controller.
- The former `GovernanceSections.tsx` bridge file was deleted and replaced with semantically named cards:
  - `AgentRiskProfileCard.tsx`
  - `DisclosureCapCard.tsx`
  - `ReviewQueueCard.tsx`
  - `IdentityReviewCard.tsx`
- `ChatRoomPage` kept its page shell and now consumes grouped controller slices:
  - `room`
  - `viewer`
  - `reporting`
  - `director`
  - `presentation`
- `DirectorPanel` was split into a local controller and tab-specific components:
  - `use-director-panel-controller.ts`
  - `DirectorControlTab.tsx`
  - `DirectorSignalsTab.tsx`
  - `DirectorMemoryTab.tsx`
- Entry file line count after slimming:
  - `src/frontend/features/admin/pages/AdminPanel.tsx`: 73 lines
  - `src/frontend/features/chat/pages/ChatRoomPage.tsx`: 164 lines
- This wave removed bridge-heavy controller passing without collapsing page-level semantic components back into monoliths.

## Wave 4
- Dead bridge exports and wrapper leftovers were removed as part of the refactor, not left for a later cleanup pass.
- A spillover fix was required in `src/backend/llm/callsite-inventory.ts` after `memory-private-digest` moved from the façade file into `memory-service/digest-pipeline.ts`.
- Final state:
  - Original entry files and import paths remain stable.
  - Internal wrapper count is reduced.
  - Backend entrypoints are thin delegation surfaces.
  - Frontend pages keep stable shells but no longer push a single megabag controller across large subtrees.
