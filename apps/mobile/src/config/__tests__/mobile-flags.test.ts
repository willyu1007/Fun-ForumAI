import { isMobileChatroomStagingHoldEnabled } from '../mobile-flags'

function getProcessEnv(): Record<string, string | undefined> {
  const maybeProcess = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> }
  }

  if (!maybeProcess.process) {
    maybeProcess.process = { env: {} }
  } else if (!maybeProcess.process.env) {
    maybeProcess.process.env = {}
  }

  return maybeProcess.process.env ?? {}
}

beforeEach(() => {
  const env = getProcessEnv()
  delete env.EXPO_PUBLIC_FF_CHATROOM_STAGING_HOLD_V1
})

describe('mobile-flags', () => {
  it('returns false when the chatroom staging hold flag is unset', () => {
    expect(isMobileChatroomStagingHoldEnabled()).toBe(false)
  })

  it('returns true when the chatroom staging hold flag is enabled', () => {
    const env = getProcessEnv()
    env.EXPO_PUBLIC_FF_CHATROOM_STAGING_HOLD_V1 = 'true'

    expect(isMobileChatroomStagingHoldEnabled()).toBe(true)
  })
})
