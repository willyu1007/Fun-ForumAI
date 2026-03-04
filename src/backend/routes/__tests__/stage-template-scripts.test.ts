import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function makeTempWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'stage-template-script-'))
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
}

function makeStageTemplateYaml(id: string): string {
  return [
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
  ].join('\n')
}

describe('stage template scripts', () => {
  it('stage-templates-export parses real YAML templates and writes dist json', () => {
    const workspace = makeTempWorkspace()
    try {
      const baseDir = path.join(workspace, 'docs/stage-templates/v1')
      writeFile(
        path.join(baseDir, 'library.manifest.yaml'),
        [
          'version: v1',
          'templates:',
          '  - id: stage-theme-01',
          '    category: theme',
          '    path: templates/stage-theme-01.yaml',
          '    status: launch',
          '    binding:',
          '      community_slug: general',
          '      binding_type: core',
        ].join('\n'),
      )
      writeFile(
        path.join(baseDir, 'templates/stage-theme-01.yaml'),
        [
          'template_id: stage-theme-01',
          'name: Theme One',
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

      const scriptPath = path.join(process.cwd(), 'scripts/stage-templates-export.mjs')
      const result = spawnSync('node', [scriptPath], { cwd: workspace, encoding: 'utf8' })
      expect(result.status).toBe(0)

      const libraryPath = path.join(baseDir, 'dist/library.json')
      expect(fs.existsSync(libraryPath)).toBe(true)
      const library = JSON.parse(fs.readFileSync(libraryPath, 'utf8')) as {
        templates: Array<{ id: string; stage_spec: { version: string } }>
      }
      expect(library.templates).toHaveLength(1)
      expect(library.templates[0].id).toBe('stage-theme-01')
      expect(library.templates[0].stage_spec.version).toBe('v1')
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })

  it('stage-season-rotate reads and writes YAML manifest', () => {
    const workspace = makeTempWorkspace()
    try {
      const baseDir = path.join(workspace, 'docs/stage-templates/v1')
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
      for (const templateId of ['launch-1', 'launch-2', 'launch-3', 'hidden-1', 'hidden-2', 'hidden-3']) {
        writeFile(path.join(baseDir, `templates/${templateId}.yaml`), makeStageTemplateYaml(templateId))
      }

      const scriptPath = path.join(process.cwd(), 'scripts/stage-season-rotate.mjs')
      const result = spawnSync('node', [scriptPath, '--open-count=3'], { cwd: workspace, encoding: 'utf8' })
      expect(result.status).toBe(0)

      const manifestRaw = fs.readFileSync(path.join(baseDir, 'library.manifest.yaml'), 'utf8')
      expect(manifestRaw.trim().startsWith('version:')).toBe(true)
      expect(manifestRaw.includes('rotation_audit:')).toBe(true)
      const distRaw = fs.readFileSync(path.join(baseDir, 'dist/library.json'), 'utf8')
      const dist = JSON.parse(distRaw) as { templates: Array<{ id: string }> }
      expect(dist.templates).toHaveLength(6)
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })
})
