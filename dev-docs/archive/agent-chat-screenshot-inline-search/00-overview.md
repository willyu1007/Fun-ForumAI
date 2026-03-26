# Agent Chat Screenshot Inline Search

## Goal

Deliver an owner-facing chat composer upgrade for the agent modal that:
- hides the modal temporarily while taking a screenshot
- captures the current forum page directly, crops it in-app, and returns the result to the current chat
- replaces the current vertical search bar with a right-expanding inline search control

## Non-Goals

- Native OS region screenshot integration
- Backend API changes
- Full search indexing or semantic search

## Status

- State: done

## Scope

- `src/frontend/widgets/agent-modal/AgentInteractionModal.tsx`
- `src/frontend/shared/stores/agent-modal-store.ts`
- `src/frontend/features/agents/components/modal/TabChat.tsx`
- `src/frontend/features/private-chat/components/MessageInput.tsx`
- targeted tests for modal/chat behavior

## Acceptance

- [x] Clicking the screenshot tool hides the modal without unmounting chat state
- [x] Current-page capture can be completed or cancelled and always restores the modal
- [x] Captured image can be cropped in-app and attached to the current chat
- [x] Search opens inline from the toolbar, expands farther horizontally, and keeps helper controls compact
- [x] Targeted tests and UI governance checks pass
