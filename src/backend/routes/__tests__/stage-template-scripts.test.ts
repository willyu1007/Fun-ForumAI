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
      `    viewer_goal: 为 ${id} 提供更强的节目感`,
      '    growth_goal: 推动公共关系演化',
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

describe('stage template scripts', () => {
  it('stage-templates-export preserves legacy v1 dist when scene-pool flags are off', () => {
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
        makeStageTemplateYaml('stage-theme-01', true),
      )

      const scriptPath = path.join(process.cwd(), 'scripts/stage-templates-export.mjs')
      const result = spawnSync('node', [scriptPath], { cwd: workspace, encoding: 'utf8' })
      expect(result.status).toBe(0)

      const libraryPath = path.join(baseDir, 'dist/library.json')
      expect(fs.existsSync(libraryPath)).toBe(true)
      const library = JSON.parse(fs.readFileSync(libraryPath, 'utf8')) as {
        version: string
        templates: Array<{ id: string; stage_spec: { version: string } }>
      }
      expect(library.version).toBe('v1')
      expect(library.templates).toHaveLength(1)
      expect(library.templates[0].id).toBe('stage-theme-01')
      expect(library.templates[0].stage_spec.version).toBe('v1')
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })

  it('stage-templates-export writes v2 dist when scene-pool flags are on', () => {
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
        makeStageTemplateYaml('stage-theme-01', true),
      )

      const scriptPath = path.join(process.cwd(), 'scripts/stage-templates-export.mjs')
      const result = spawnSync('node', [scriptPath], {
        cwd: workspace,
        encoding: 'utf8',
        env: {
          ...process.env,
          FF_PUBLIC_DIRECTOR_CONTRACT_V1: 'true',
          FF_SCENE_POOL_ASSET_OPS_V1: 'true',
        },
      })
      expect(result.status).toBe(0)

      const libraryPath = path.join(baseDir, 'dist/library.json')
      const library = JSON.parse(fs.readFileSync(libraryPath, 'utf8')) as {
        version: string
        templates: Array<{
          id: string
          stage_spec: { version: string }
          stage_template_v2: {
            lifecycle_status: string
            director: { scene_goal: { viewer_goal: string } }
          }
        }>
        stage_templates: Array<unknown>
        scene_bindings: Array<unknown>
      }
      expect(library.version).toBe('v2')
      expect(library.templates[0].stage_template_v2.lifecycle_status).toBe('core_active')
      expect(library.templates[0].stage_template_v2.director.scene_goal.viewer_goal).toContain('节目感')
      expect(library.stage_templates).toHaveLength(1)
      expect(library.scene_bindings).toHaveLength(1)
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })

  it('stage-season-rotate reads and writes YAML manifest with v2 dist when scene-pool flags are on', () => {
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
        writeFile(
          path.join(baseDir, `templates/${templateId}.yaml`),
          makeStageTemplateYaml(templateId, templateId === 'hidden-1'),
        )
      }

      const scriptPath = path.join(process.cwd(), 'scripts/stage-season-rotate.mjs')
      const result = spawnSync('node', [scriptPath, '--open-count=3'], {
        cwd: workspace,
        encoding: 'utf8',
        env: {
          ...process.env,
          FF_PUBLIC_DIRECTOR_CONTRACT_V1: 'true',
          FF_SCENE_POOL_ASSET_OPS_V1: 'true',
        },
      })
      expect(result.status).toBe(0)

      const manifestRaw = fs.readFileSync(path.join(baseDir, 'library.manifest.yaml'), 'utf8')
      expect(manifestRaw.trim().startsWith('version:')).toBe(true)
      expect(manifestRaw.includes('rotation_audit:')).toBe(true)
      const distRaw = fs.readFileSync(path.join(baseDir, 'dist/library.json'), 'utf8')
      const dist = JSON.parse(distRaw) as {
        version: string
        templates: Array<{ id: string; stage_template_v2: { director: { scene_goal: { viewer_goal: string } } } }>
        stage_templates: Array<unknown>
        scene_bindings: Array<unknown>
      }
      expect(dist.version).toBe('v2')
      expect(dist.templates).toHaveLength(6)
      expect(dist.stage_templates).toHaveLength(6)
      expect(dist.scene_bindings).toHaveLength(3)
      expect(dist.templates.find((item) => item.id === 'hidden-1')?.stage_template_v2.director.scene_goal.viewer_goal)
        .toContain('节目感')
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })
})
