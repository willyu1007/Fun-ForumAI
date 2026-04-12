import { mkdtempSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  REQUIRED_LAUNCH_FRONTEND_CAPABILITIES,
  loadFrontendBuildProfile,
  toDockerBuildArgs,
  writeFrontendCapabilityProof,
} from '../frontend-build-profile.mjs'

describe('frontend build profile', () => {
  it('loads the canonical launch profile with the required launch capabilities', () => {
    const profile = loadFrontendBuildProfile('launch')

    expect(profile.target).toBe('llm-forum')
    expect(profile.profile).toBe('launch')
    expect(Object.keys(profile.frontend_capabilities).sort()).toEqual(
      [...REQUIRED_LAUNCH_FRONTEND_CAPABILITIES].sort(),
    )
    expect(Object.values(profile.frontend_capabilities)).toEqual(expect.arrayContaining([true]))
  })

  it('emits a proof artifact and docker build args from the same profile source', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'frontend-build-profile-'))
    const outPath = join(tempDir, 'frontend-build-capabilities.json')
    const originalChatroomHold = process.env.VITE_FF_CHATROOM_STAGING_HOLD_V1

    process.env.VITE_FF_CHATROOM_STAGING_HOLD_V1 = 'true'
    try {
      const proof = writeFrontendCapabilityProof('launch', outPath)
      const written = JSON.parse(readFileSync(outPath, 'utf8'))
      const dockerBuildArgs = toDockerBuildArgs(loadFrontendBuildProfile('launch'))

      expect(written).toEqual(proof)
      expect(written.frontend_capabilities.home_programming).toBe(true)
      expect(written.build_env_flags.chatroom_staging_hold).toBe(true)
      expect(dockerBuildArgs).toEqual([['FRONTEND_BUILD_PROFILE', 'launch']])
    } finally {
      if (typeof originalChatroomHold === 'string') {
        process.env.VITE_FF_CHATROOM_STAGING_HOLD_V1 = originalChatroomHold
      } else {
        delete process.env.VITE_FF_CHATROOM_STAGING_HOLD_V1
      }
    }
  })
})
