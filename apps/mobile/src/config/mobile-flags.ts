function readEnv(name: string): string | undefined {
  const maybeProcess = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> }
  }
  return maybeProcess.process?.env?.[name]
}

function readBooleanFlag(name: string): boolean {
  return readEnv(name) === 'true'
}

export function isMobileChatroomStagingHoldEnabled(): boolean {
  return readBooleanFlag('EXPO_PUBLIC_FF_CHATROOM_STAGING_HOLD_V1')
}
