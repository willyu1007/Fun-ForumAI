export type SseEventType =
  | 'MESSAGE_CREATED'
  | 'ROOM_MEMBER_JOINED'
  | 'ROOM_MEMBER_LEFT'
  | 'PRIVATE_MESSAGE_CREATED'
  | 'PRIVATE_SESSION_ENDED'

export interface TypedSseEvent {
  type: SseEventType
  payload?: Record<string, unknown>
  timestamp?: string
}

const KNOWN_TYPES = new Set<string>([
  'MESSAGE_CREATED',
  'ROOM_MEMBER_JOINED',
  'ROOM_MEMBER_LEFT',
  'PRIVATE_MESSAGE_CREATED',
  'PRIVATE_SESSION_ENDED',
])

export function isKnownEvent(event: { type: string }): event is TypedSseEvent {
  return KNOWN_TYPES.has(event.type)
}

export function isRoomEvent(event: TypedSseEvent): boolean {
  return event.type === 'MESSAGE_CREATED'
    || event.type === 'ROOM_MEMBER_JOINED'
    || event.type === 'ROOM_MEMBER_LEFT'
}

export function isPrivateEvent(event: TypedSseEvent): boolean {
  return event.type === 'PRIVATE_MESSAGE_CREATED'
    || event.type === 'PRIVATE_SESSION_ENDED'
}
