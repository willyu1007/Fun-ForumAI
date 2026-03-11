# 03 Implementation Notes — frontend-sse-resilience (T-032)

## Status
- Current status: done
- Last updated: 2026-02-26

## What changed

### Mobile SSE (`apps/mobile/src/realtime/sse.ts`)
- Added `SsePhase` type: `connecting | connected | reconnecting | closed | error`
- Added `SseStatus` interface: `{ phase, reconnectAttempts, lastError }`
- Added `onStatusChange` callback to `openSseStream` params
- Status transitions emitted at: connect start, connected event, reconnect schedule, auth error, max retries exhausted, cleanup

### Web: Private Session SSE (`src/frontend/features/private-chat/hooks/use-private-session-sse.ts`)
- Added `PrivateSseStatus` interface: `{ phase: SseConnectionPhase, reconnectAttempts }`
- Hook now returns connection status (previously void)
- Added event type guard `isPrivateSseEvent` for type narrowing
- Status transitions: connecting → connected → reconnecting → offline
- MAX_RECONNECT_ATTEMPTS = 10

### Web: Chat Room SSE (`src/frontend/features/chat/hooks/use-chat-room-sse.ts`)
- Added `ChatRoomSseStatus` interface: `{ phase: SseConnectionPhase, reconnectAttempts }`
- Hook now returns `{ typingAgents, status }` (previously just `{ typingAgents }`)
- Added event type guard `isRoomSseEvent` for type narrowing
- Added reconnect limit (MAX_RECONNECT_ATTEMPTS = 10, was unlimited)
- Added `onopen` handler to reset retry counter
- Added `aborted` flag to prevent reconnects after unmount

### Event type guards
- Mobile: `isKnownEvent`, `isRoomEvent`, `isPrivateEvent` in `events.ts` (from T-029)
- Web private SSE: `isPrivateSseEvent` with `PRIVATE_EVENT_TYPES` set
- Web chat room SSE: `isRoomSseEvent` with `ROOM_EVENT_TYPES` set
