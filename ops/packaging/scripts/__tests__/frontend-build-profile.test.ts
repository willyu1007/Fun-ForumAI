import { mkdtempSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  REQUIRED_LAUNCH_FRONTEND_FLAGS,
  loadFrontendBuildProfile,
  toDockerBuildArgs,
  writeFrontendFlagProof,
} from '../frontend-build-profile.mjs'

describe('frontend build profile', () => {
  it('loads the canonical launch profile with the required launch flags', () => {
    const profile = loadFrontendBuildProfile('launch')

    expect(profile.target).toBe('llm-forum')
    expect(profile.profile).toBe('launch')
    expect(Object.keys(profile.frontend_flags).sort()).toEqual(
      [...REQUIRED_LAUNCH_FRONTEND_FLAGS].sort(),
    )
    expect(Object.values(profile.frontend_flags)).toEqual(
      expect.arrayContaining(['true']),
    )
  })

  it('emits a proof artifact and docker build args from the same profile source', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'frontend-build-profile-'))
    const outPath = join(tempDir, 'frontend-build-flags.json')

    const proof = writeFrontendFlagProof('launch', outPath)
    const written = JSON.parse(readFileSync(outPath, 'utf8'))
    const dockerBuildArgs = toDockerBuildArgs(loadFrontendBuildProfile('launch'))

    expect(written).toEqual(proof)
    expect(written.frontend_flags.VITE_FF_HOME_PROGRAMMING_V1).toBe('true')
    expect(dockerBuildArgs).toEqual(expect.arrayContaining([
      ['FRONTEND_BUILD_PROFILE', 'launch'],
      ['VITE_FF_HOME_PROGRAMMING_V1', 'true'],
      ['VITE_FF_PROGRAMMING_OPS_V1', 'true'],
    ]))
  })
})
