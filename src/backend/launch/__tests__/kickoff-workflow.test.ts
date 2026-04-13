import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stringify as stringifyYaml } from 'yaml'
import {
  readKickoffPatchPackRegistry,
  readKickoffQualityProfile,
  readKickoffWorkflowManifest,
  readKickoffWorkflowProfile,
  resolveKickoffPatchPackPath,
} from '../kickoff-workflow.js'

describe('kickoff workflow declarations', () => {
  it('loads the default kickoff manifest, profiles, and quality contract', () => {
    const manifest = readKickoffWorkflowManifest()
    const candidateProfile = readKickoffWorkflowProfile('local-llm-assisted-candidate')
    const runtimeSimulationProfile = readKickoffWorkflowProfile('local-llm-assisted-runtime-simulation')
    const quality = readKickoffQualityProfile()
    const registry = readKickoffPatchPackRegistry()

    expect(manifest.entrypoint).toBe('local-kickoff-workflow')
    expect(manifest.profiles.map((item) => item.id)).toEqual([
      'local-llm-assisted-candidate',
      'local-llm-assisted-runtime-simulation',
    ])
    expect(candidateProfile.mode).toBe('candidate')
    expect(runtimeSimulationProfile.import_defaults.allow_runtime_instruction_payload).toBe(true)
    expect(quality.coverage_floor.communities).toBeGreaterThan(0)
    expect(Array.isArray(registry.packs)).toBe(true)
    expect(resolveKickoffPatchPackPath('missing-pack')).toBeNull()
  })

  it('rejects self-referential kickoff manifests rooted in the repo workspace', () => {
    const dir = mkdtempSync(join(process.cwd(), '.ai/.tmp/kickoff-workflow-test-'))
    const manifestPath = join(dir, 'manifest.v1.yaml')
    const manifestRelativePath = relative(process.cwd(), manifestPath)
    try {
      writeFileSync(
        manifestPath,
        stringifyYaml({
          version: 1,
          entrypoint: 'self-ref-test',
          launch_manifest_path: 'config/launch/manifest.v1.yaml',
          contracts: {
            authoring_patch: 'config/kickoff/contracts/authoring-patch.v1.schema.json',
            import_report: 'config/kickoff/contracts/import-report.v1.schema.json',
            runtime_readiness: 'config/kickoff/contracts/runtime-readiness.v1.schema.json',
          },
          profiles: [
            {
              id: 'local-llm-assisted-candidate',
              path: 'config/kickoff/profiles/local-llm-assisted-candidate.v1.yaml',
            },
            {
              id: 'local-llm-assisted-runtime-simulation',
              path: 'config/kickoff/profiles/local-llm-assisted-runtime-simulation.v1.yaml',
            },
          ],
          quality_profiles: {
            default: 'config/kickoff/quality/acceptance.v1.yaml',
          },
          patch_pack_registry: manifestRelativePath,
          verification_boundary: [
            'repo_contract',
            'kickoff_import',
            'kickoff_runtime_readiness',
          ],
        }),
        'utf8',
      )

      expect(() => readKickoffWorkflowManifest(manifestPath)).toThrowError(
        /self-referential path graph is not allowed/,
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects kickoff manifests with duplicate profile ids', () => {
    const dir = mkdtempSync(join(process.cwd(), '.ai/.tmp/kickoff-workflow-test-'))
    const manifestPath = join(dir, 'manifest.v1.yaml')
    try {
      writeFileSync(
        manifestPath,
        stringifyYaml({
          version: 1,
          entrypoint: 'duplicate-profile-test',
          launch_manifest_path: 'config/launch/manifest.v1.yaml',
          contracts: {
            authoring_patch: 'config/kickoff/contracts/authoring-patch.v1.schema.json',
            import_report: 'config/kickoff/contracts/import-report.v1.schema.json',
            runtime_readiness: 'config/kickoff/contracts/runtime-readiness.v1.schema.json',
          },
          profiles: [
            {
              id: 'local-llm-assisted-candidate',
              path: 'config/kickoff/profiles/local-llm-assisted-candidate.v1.yaml',
            },
            {
              id: 'local-llm-assisted-candidate',
              path: 'config/kickoff/profiles/local-llm-assisted-candidate.v1.yaml',
            },
          ],
          quality_profiles: {
            default: 'config/kickoff/quality/acceptance.v1.yaml',
          },
          patch_pack_registry: 'config/kickoff/patch-packs/registry.v1.yaml',
          verification_boundary: [
            'repo_contract',
            'kickoff_import',
            'kickoff_runtime_readiness',
          ],
        }),
        'utf8',
      )

      expect(() => readKickoffWorkflowManifest(manifestPath)).toThrowError(/duplicate profile id/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
