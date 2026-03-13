import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import { describe, expect, it } from 'vitest'
import type { StageTemplateManifest } from '../stage-template-ops.js'
import { applySeasonRotationAtomic, buildStageTemplateDistPayload } from '../stage-template-ops.js'

function makeTempWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'stage-template-ops-'))
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
}

function makeStageTemplateYaml(id: string, withDirector = false): string {
  const lines = [
    `template_id: ${id}`,
    `name: ${id}`,
    'stage_spec:',
    '  version: v1',
    '  min_tier_pool: T1',
    '  roles:',
    '    resident:',
    '      min_tier: T1',
    '      runtime_gate: true',
    '      t4_longform_only: false',
    '  tier_gate:',
    '    resident_min_tier: T1',
    '    core_min_tier: T1',
    '    t4_longform_min_tier: T1',
    '  strict_t4:',
    '    enabled: false',
    '    premod_required: true',
    '    min_sources: 3',
    '    grant_required: true',
    '    max_ttl_hours: 168',
    '    redaction: strong',
    '  aftershow:',
    '    mode: OFF',
    '    threshold:',
    '      min_comments: 30',
    '      min_human_vote_score: 10',
    '    periodic:',
    '      enabled: false',
    '      interval_hours: 24',
  ]
  if (withDirector) {
    lines.push(
      'director:',
      '  scene_goal:',
      `    viewer_goal: 为 ${id} 增加导播目标`,
      '    growth_goal: 增加角色关系张力',
      '  casting_recipe:',
      '    quota: 5',
      '    ratio:',
      '      core: 3',
      '      contrast: 1',
      '      wildcard: 1',
      '    wildcard_cap: 1',
    )
  }
  return lines.join('\n')
}

function seedFixture(baseDir: string): void {
  writeFile(
    path.join(baseDir, 'library.manifest.yaml'),
    [
      'version: v1',
      'templates:',
      '  - id: launch-1',
      '    category: theme',
      '    path: templates/launch-1.yaml',
      '    status: launch',
      '    binding:',
      '      community_slug: season-slot-1',
      '      slot: season-slot-1',
      '      binding_type: seasonal',
      '  - id: launch-2',
      '    category: theme',
      '    path: templates/launch-2.yaml',
      '    status: launch',
      '    binding:',
      '      community_slug: season-slot-2',
      '      slot: season-slot-2',
      '      binding_type: seasonal',
      '  - id: launch-3',
      '    category: theme',
      '    path: templates/launch-3.yaml',
      '    status: launch',
      '    binding:',
      '      community_slug: season-slot-3',
      '      slot: season-slot-3',
      '      binding_type: seasonal',
      '  - id: hidden-1',
      '    category: theme',
      '    path: templates/hidden-1.yaml',
      '    status: hidden',
      '    binding: null',
      '  - id: hidden-2',
      '    category: theme',
      '    path: templates/hidden-2.yaml',
      '    status: hidden',
      '    binding: null',
      '  - id: hidden-3',
      '    category: theme',
      '    path: templates/hidden-3.yaml',
      '    status: hidden',
      '    binding: null',
      'seasonal_slots:',
      '  - slot: season-slot-1',
      '    community_slug: season-slot-1',
      '  - slot: season-slot-2',
      '    community_slug: season-slot-2',
      '  - slot: season-slot-3',
      '    community_slug: season-slot-3',
    ].join('\n'),
  )

  for (const id of ['launch-1', 'launch-2', 'launch-3', 'hidden-1', 'hidden-2', 'hidden-3']) {
    writeFile(
      path.join(baseDir, `templates/${id}.yaml`),
      makeStageTemplateYaml(id, id === 'hidden-1'),
    )
  }

  writeFile(path.join(baseDir, 'dist/library.json'), '{"version":"before"}\n')
  writeFile(path.join(baseDir, 'dist/launch.json'), '{"version":"before"}\n')
}

describe('stage-template-ops', () => {
  it('keeps legacy v1 dist payloads when scene-pool flags are off', () => {
    const workspace = makeTempWorkspace()
    try {
      const baseDir = path.join(workspace, 'docs/stage-templates/v1')
      seedFixture(baseDir)
      const manifest = parseYaml(
        fs.readFileSync(path.join(baseDir, 'library.manifest.yaml'), 'utf8'),
      ) as StageTemplateManifest

      const dist = buildStageTemplateDistPayload(baseDir, manifest, '2026-03-13T00:00:00.000Z', {
        publicDirectorContractV1: false,
        scenePoolAssetOpsV1: false,
      })

      expect(dist.library.version).toBe('v1')
      expect(dist.launch.version).toBe('v1')
      expect(dist.library).not.toHaveProperty('stage_templates')
      expect(dist.library.templates).toHaveLength(6)
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })

  it('applies season rotation and writes v2 manifest/dist when scene-pool flags are on', () => {
    const workspace = makeTempWorkspace()
    try {
      const baseDir = path.join(workspace, 'docs/stage-templates/v1')
      seedFixture(baseDir)

      const result = applySeasonRotationAtomic({
        base_dir: baseDir,
        open_count: 3,
        dry_run: false,
        publicDirectorContractV1: true,
        scenePoolAssetOpsV1: true,
      })

      expect(result.dry_run).toBe(false)
      expect(result.replaced).toHaveLength(3)
      expect(result.activated).toHaveLength(3)
      expect(result.exported_templates).toBe(6)
      expect(result.launch_templates).toBe(3)

      const manifest = parseYaml(fs.readFileSync(path.join(baseDir, 'library.manifest.yaml'), 'utf8')) as {
        rotation_audit?: unknown[]
      }
      expect(Array.isArray(manifest.rotation_audit)).toBe(true)
      expect(manifest.rotation_audit).toHaveLength(1)

      const library = JSON.parse(fs.readFileSync(path.join(baseDir, 'dist/library.json'), 'utf8')) as {
        version: string
        templates: Array<{
          id: string
          stage_template_v2: {
            lifecycle_status: string
            director: { scene_goal: { viewer_goal: string } }
          }
        }>
        scene_bindings: Array<unknown>
      }
      expect(library.version).toBe('v2')
      expect(library.templates).toHaveLength(6)
      expect(library.scene_bindings).toHaveLength(3)
      expect(library.templates.find((item) => item.id === 'hidden-1')?.stage_template_v2.director.scene_goal.viewer_goal)
        .toContain('导播目标')
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })

  it('rolls back manifest and dist when write pipeline fails', () => {
    const workspace = makeTempWorkspace()
    try {
      const baseDir = path.join(workspace, 'docs/stage-templates/v1')
      seedFixture(baseDir)

      const manifestBefore = fs.readFileSync(path.join(baseDir, 'library.manifest.yaml'), 'utf8')
      const libraryBefore = fs.readFileSync(path.join(baseDir, 'dist/library.json'), 'utf8')
      const launchBefore = fs.readFileSync(path.join(baseDir, 'dist/launch.json'), 'utf8')

      expect(() => applySeasonRotationAtomic({
        base_dir: baseDir,
        open_count: 3,
        dry_run: false,
        inject_failure_step: 'after_dist_commit',
        publicDirectorContractV1: true,
        scenePoolAssetOpsV1: true,
      })).toThrow('Season rotation failed')

      const manifestAfter = fs.readFileSync(path.join(baseDir, 'library.manifest.yaml'), 'utf8')
      const libraryAfter = fs.readFileSync(path.join(baseDir, 'dist/library.json'), 'utf8')
      const launchAfter = fs.readFileSync(path.join(baseDir, 'dist/launch.json'), 'utf8')

      expect(manifestAfter).toBe(manifestBefore)
      expect(libraryAfter).toBe(libraryBefore)
      expect(launchAfter).toBe(launchBefore)
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })
})
