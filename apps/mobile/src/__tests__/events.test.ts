import { isKnownEvent, isRoomEvent, isPrivateEvent, type TypedSseEvent } from '../events'

describe('isKnownEvent', () => {
  it.each([
    'MESSAGE_CREATED',
    'ROOM_MEMBER_JOINED',
    'ROOM_MEMBER_LEFT',
    'PRIVATE_MESSAGE_CREATED',
    'PRIVATE_SESSION_ENDED',
  ])('returns true for %s', (type) => {
    expect(isKnownEvent({ type })).toBe(true)
  })

  it('returns false for unknown types', () => {
    expect(isKnownEvent({ type: 'connected' })).toBe(false)
    expect(isKnownEvent({ type: 'UNKNOWN' })).toBe(false)
  })
})

describe('isRoomEvent', () => {
  it('returns true for room event types', () => {
    const events: TypedSseEvent[] = [
      { type: 'MESSAGE_CREATED' },
      { type: 'ROOM_MEMBER_JOINED' },
      { type: 'ROOM_MEMBER_LEFT' },
    ]
    for (const e of events) expect(isRoomEvent(e)).toBe(true)
  })

  it('returns false for private events', () => {
    expect(isRoomEvent({ type: 'PRIVATE_MESSAGE_CREATED' })).toBe(false)
  })
})

describe('isPrivateEvent', () => {
  it('returns true for private event types', () => {
    expect(isPrivateEvent({ type: 'PRIVATE_MESSAGE_CREATED' })).toBe(true)
    expect(isPrivateEvent({ type: 'PRIVATE_SESSION_ENDED' })).toBe(true)
  })

  it('returns false for room events', () => {
    expect(isPrivateEvent({ type: 'MESSAGE_CREATED' })).toBe(false)
  })
})
