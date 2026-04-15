import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalStorageAdapter } from '../../services/storage-adapter.js'
import { config } from '../../lib/config.js'
import { ValidationError } from '../../lib/errors.js'
import { parseMediaImportManifest } from '../media-injection-manifest.js'
import { MediaImportArtifactService } from '../media-import-artifact-service.js'
import { MediaInjectionService } from '../media-injection-service.js'
import { InMemoryMediaImportJobRepository } from '../../repos/media-import-job-repository.js'
import { InMemoryMediaImportJobItemRepository } from '../../repos/media-import-job-item-repository.js'

const tempDirs: string[] = []
const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
const originalMediaInjectionFlag = featureFlags.mediaInjectionV1

afterEach(async () => {
  featureFlags.mediaInjectionV1 = originalMediaInjectionFlag
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('parseMediaImportManifest', () => {
  it('normalizes defaults into media injection requests', () => {
    const parsed = parseMediaImportManifest({
      format: 'yaml',
      raw_manifest_text: `
manifest_meta:
  contract_version: 1
  manifest_kind: media_import
  manifest_id: manifest-01
  generated_by_tool: test
  generated_at: 2026-04-15T12:00:00Z
defaults:
  entrypoint: cli_manifest
  indexing:
    primary_scope: public_safe
    public_safe_enabled: true
    embedding_policy_id: text-embedding-v4-1024
  dedupe:
    policy_id: exact_and_near
  reuse:
    mode_id: default
  catalog:
    policy_id: standard
items:
  - item_id: asset-1
    input_kind: local_file
    source_kind: platform_canonical
    path: ./asset.png
    target_scope:
      steward_agent_id: agent-media
`,
    })

    expect(parsed.requests).toHaveLength(1)
    expect(parsed.requests[0]).toMatchObject({
      item_id: 'asset-1',
      source_kind: 'platform_canonical',
      indexing: {
        primary_scope: 'public_safe',
        public_safe_enabled: true,
        embedding_policy_id: 'text-embedding-v4-1024',
      },
      reuse: {
        mode_id: 'default',
      },
      catalog: {
        policy_id: 'standard',
      },
    })
  })

  it('rejects community commons items without community id', () => {
    expect(() => parseMediaImportManifest({
      format: 'yaml',
      raw_manifest_text: `
manifest_meta:
  contract_version: 1
  manifest_kind: media_import
  manifest_id: manifest-02
  generated_by_tool: test
  generated_at: 2026-04-15T12:00:00Z
defaults:
  entrypoint: cli_manifest
items:
  - item_id: asset-1
    input_kind: remote_url
    source_kind: community_commons
    url: https://example.com/asset.png
`,
    })).toThrow(ValidationError)
  })
})

describe('MediaInjectionService.stageApply', () => {
  it('stages local files and creates staged import job items', async () => {
    featureFlags.mediaInjectionV1 = true
    const root = await mkdtemp(join(tmpdir(), 'media-injection-test-'))
    tempDirs.push(root)
    const assetPath = join(root, 'asset.png')
    await writeFile(
      assetPath,
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6W7k8AAAAASUVORK5CYII=', 'base64'),
    )
    const manifestPath = join(root, 'manifest.yaml')
    const manifestText = `
manifest_meta:
  contract_version: 1
  manifest_kind: media_import
  manifest_id: manifest-03
  generated_by_tool: test
  generated_at: 2026-04-15T12:00:00Z
defaults:
  entrypoint: cli_manifest
  indexing:
    primary_scope: public_safe
    public_safe_enabled: true
    embedding_policy_id: text-embedding-v4-1024
  dedupe:
    policy_id: exact_and_near
  reuse:
    mode_id: default
  catalog:
    policy_id: standard
items:
  - item_id: asset-1
    input_kind: local_file
    source_kind: platform_canonical
    path: ./asset.png
    target_scope:
      steward_agent_id: agent-media
`
    await writeFile(manifestPath, manifestText, 'utf8')

    const storage = new LocalStorageAdapter({
      baseDir: join(root, 'storage'),
    })
    const artifactService = new MediaImportArtifactService({ storage })
    const service = new MediaInjectionService({
      mediaImportJobRepo: new InMemoryMediaImportJobRepository(),
      mediaImportJobItemRepo: new InMemoryMediaImportJobItemRepository(),
      mediaImportArtifactService: artifactService,
    })

    const job = await service.stageApply({
      manifest_path: manifestPath,
      raw_manifest_text: manifestText,
      format: 'yaml',
      requested_by_type: 'system',
      requested_by_id: 'test-suite',
    })

    expect(job.status).toBe('staged')
    expect(job.total_items).toBe(1)
    expect(job.staging_manifest_key).toContain('/raw-manifest.yaml')

    const normalized = await artifactService.readText(job.normalized_manifest_key!)
    expect(normalized).toContain('"item_id": "asset-1"')

    const stagedItemKey = `${job.staging_manifest_key.replace('/raw-manifest.yaml', '')}/items/asset-1.png`
    const stagedAsset = await artifactService.readBuffer(stagedItemKey)
    expect(stagedAsset?.content_type).toBe('image/png')
    expect((await readFile(assetPath)).byteLength).toBe(stagedAsset?.data.byteLength)
  })

  it('rejects apply when media injection feature flag is disabled', async () => {
    featureFlags.mediaInjectionV1 = false
    const root = await mkdtemp(join(tmpdir(), 'media-injection-disabled-'))
    tempDirs.push(root)
    const manifestPath = join(root, 'manifest.yaml')
    const manifestText = `
manifest_meta:
  contract_version: 1
  manifest_kind: media_import
  manifest_id: manifest-disabled
  generated_by_tool: test
  generated_at: 2026-04-15T12:00:00Z
defaults:
  entrypoint: cli_manifest
items:
  - item_id: asset-1
    input_kind: existing_asset_ref
    asset_id: asset-1
    source_kind: platform_canonical
`
    await writeFile(manifestPath, manifestText, 'utf8')

    const storage = new LocalStorageAdapter({
      baseDir: join(root, 'storage'),
    })
    const artifactService = new MediaImportArtifactService({ storage })
    const service = new MediaInjectionService({
      mediaImportJobRepo: new InMemoryMediaImportJobRepository(),
      mediaImportJobItemRepo: new InMemoryMediaImportJobItemRepository(),
      mediaImportArtifactService: artifactService,
    })

    await expect(service.stageApply({
      manifest_path: manifestPath,
      raw_manifest_text: manifestText,
      format: 'yaml',
      requested_by_type: 'system',
      requested_by_id: 'test-suite',
    })).rejects.toThrow('FF_MEDIA_INJECTION_V1')
  })
})
