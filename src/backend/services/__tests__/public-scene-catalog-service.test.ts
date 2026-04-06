import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { listLaunchCommunitySeeds } from '../../launch/community-rules.js'
import { PublicSceneCatalogService } from '../public-scene-catalog-service.js'

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe('PublicSceneCatalogService', () => {
  it('rebuilds launch catalog from source when dist artifact is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-catalog-'))
    tempDirs.push(tempDir)

    const sourceDir = path.join(tempDir, 'source')
    const distDir = path.join(tempDir, 'dist')
    fs.cpSync(path.resolve(process.cwd(), 'docs/stage-templates/source'), sourceDir, { recursive: true })

    const service = new PublicSceneCatalogService({
      sourceBaseDir: sourceDir,
      manifestPath: path.join(sourceDir, 'manifest.yaml'),
      libraryPath: path.join(distDir, 'library.json'),
      launchPath: path.join(distDir, 'launch.json'),
    })

    const catalog = service.getLaunchCatalog()

    expect(catalog).toBeTruthy()
    expect(catalog?.version).toBe('v2')
    expect(Array.isArray(catalog?.stage_templates)).toBe(true)
    expect((catalog?.stage_templates.length ?? 0)).toBeGreaterThan(0)
    expect(fs.existsSync(path.join(distDir, 'launch.json'))).toBe(true)
    expect(fs.existsSync(path.join(distDir, 'library.json'))).toBe(true)
  })

  it('keeps stage-show-01 launch bindings aligned with non-creator-note launch communities', () => {
    const service = new PublicSceneCatalogService()
    const catalog = service.getLaunchCatalog()

    expect(catalog).toBeTruthy()
    const expectedSlugs = listLaunchCommunitySeeds()
      .filter((community) => {
        const creatorNoteRuntime = community.rules_json.creator_note_runtime as Record<string, unknown> | undefined
        return creatorNoteRuntime?.enabled !== true
      })
      .map((community) => community.slug)
      .sort()

    const actualSlugs = (catalog?.scene_bindings ?? [])
      .flatMap((binding) => {
        if (
          binding.template_id !== 'stage-show-01'
          || binding.target.surface !== 'forum'
          || !('community_slug' in binding.target)
        ) {
          return []
        }
        return [binding.target.community_slug]
      })
      .sort()

    expect(actualSlugs).toEqual(expectedSlugs)
  })
})
