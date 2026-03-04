import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import { describe, expect, it } from 'vitest'
import { applySeasonRotationAtomic } from '../stage-template-ops.js'

function makeTempWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'stage-template-ops-'))
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
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
      [
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
      ].join('\n'),
    )
  }

  writeFile(path.join(baseDir, 'dist/library.json'), '{"version":"before"}\n')
  writeFile(path.join(baseDir, 'dist/launch.json'), '{"version":"before"}\n')
}

describe('stage-template-ops', () => {
  it('applies season rotation and writes manifest/dist in one run', () => {
    const workspace = makeTempWorkspace()
    try {
      const baseDir = path.join(workspace, 'docs/stage-templates/v1')
      seedFixture(baseDir)

      const result = applySeasonRotationAtomic({
        base_dir: baseDir,
        open_count: 3,
        dry_run: false,
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
        templates: unknown[]
      }
      expect(library.templates).toHaveLength(6)
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
