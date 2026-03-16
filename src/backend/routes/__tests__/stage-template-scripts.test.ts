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

function makeStageTemplateYaml(
  id: string,
  withChatroom = false,
): string {
  const lines = [
    `template_id: ${id}`,
    'template_version: v2',
    `name: ${id}`,
    'category: theme',
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
    '      audience_comments: 30',
    '      human_vote_score: 10',
    '    periodic:',
    '      enabled: false',
    '      interval_hours: 24',
    'director:',
    '  applicable_surfaces:',
    '    - forum',
    '    - scheduled_post',
    ...(withChatroom ? ['    - chat_room'] : []),
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
    '    must_have_roles: []',
    '    avoid_pairs: []',
    '    relationship_objectives: []',
    '  beat_plan:',
    '    phases:',
    '      - opening',
    '      - escalation',
    '      - pivot',
    '      - closure',
    '    optional_beats: []',
    '  fatigue_policy:',
    '    cooldown_hours: 24',
    '    repeat_penalty: 1',
    '    max_runs_per_day: 3',
    '  closing_policy:',
    '    ttl_hours: 24',
    '    min_turns: 3',
    '    message_threshold: 12',
    '    aftershow_mode: off',
    '  hot_topic_policy:',
    '    injection_mode: overlay_only',
    '    sensitive_topic_mode: standard',
    '  autonomy_policy:',
    '    allow_autonomous_mutation: false',
    '    require_pool_match_before_create: true',
  ]
  return lines.join('\n')
}

function seasonalBindingBlock(slot: string): string[] {
  return [
    '      - surface: forum',
    `        community_slug: ${slot}`,
    `        seasonal_slot: ${slot}`,
    '        binding_type: seasonal',
    '        lifecycle: {}',
    '        weights:',
    '          editorial_priority: 10',
    '          base_weight: 1',
    '          freshness_bonus: 1',
    '        activation:',
    '          time_windows: []',
    '          allowed_days: [mon, tue, wed, thu, fri, sat, sun]',
    '          trigger_conditions: []',
    '        governance: {}',
    '        constraints: {}',
  ]
}

describe('stage template scripts', () => {
  it('stage-templates-export writes v2 dist into docs/stage-templates/dist', () => {
    const workspace = makeTempWorkspace()
    try {
      const sourceDir = path.join(workspace, 'docs/stage-templates/source')
      writeFile(
        path.join(sourceDir, 'manifest.yaml'),
        [
          'version: v2',
          'templates:',
          '  - id: stage-theme-01',
          '    category: theme',
          '    path: templates/stage-theme-01.yaml',
          '    lifecycle_status: core_active',
          '    bindings:',
          '      - surface: forum',
          '        community_slug: general',
          '        seasonal_slot: null',
          '        binding_type: core',
          '        lifecycle: {}',
          '        weights:',
          '          editorial_priority: 5',
          '          base_weight: 1',
          '          freshness_bonus: 0',
          '        activation:',
          '          time_windows: []',
          '          allowed_days: [mon, tue, wed, thu, fri, sat, sun]',
          '          trigger_conditions: []',
          '        governance: {}',
          '        constraints: {}',
          'seasonal_slots: []',
        ].join('\n'),
      )
      writeFile(
        path.join(sourceDir, 'templates/stage-theme-01.yaml'),
        makeStageTemplateYaml('stage-theme-01'),
      )

      const scriptPath = path.join(process.cwd(), 'scripts/stage-templates-export.mjs')
      const result = spawnSync('node', [scriptPath], { cwd: workspace, encoding: 'utf8' })
      expect(result.status).toBe(0)

      const libraryPath = path.join(workspace, 'docs/stage-templates/dist/library.json')
      expect(fs.existsSync(libraryPath)).toBe(true)
      const library = JSON.parse(fs.readFileSync(libraryPath, 'utf8')) as {
        version: string
        stage_templates: Array<{ template_version: string }>
        scene_bindings: Array<unknown>
      }
      expect(library.version).toBe('v2')
      expect(library.stage_templates).toHaveLength(1)
      expect(library.stage_templates[0].template_version).toBe('v2')
      expect(library.scene_bindings).toHaveLength(1)
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })

  it('stage-templates-validate accepts authoring v2 source', () => {
    const workspace = makeTempWorkspace()
    try {
      const sourceDir = path.join(workspace, 'docs/stage-templates/source')
      writeFile(
        path.join(sourceDir, 'manifest.yaml'),
        [
          'version: v2',
          'templates:',
          '  - id: stage-theme-01',
          '    category: theme',
          '    path: templates/stage-theme-01.yaml',
          '    lifecycle_status: hidden',
          '    bindings: []',
          '  - id: stage-theme-02',
          '    category: theme',
          '    path: templates/stage-theme-02.yaml',
          '    lifecycle_status: core_active',
          '    bindings:',
          '      - surface: forum',
          '        community_slug: general',
          '        seasonal_slot: null',
          '        binding_type: core',
          '        lifecycle: {}',
          '        weights:',
          '          editorial_priority: 5',
          '          base_weight: 1',
          '          freshness_bonus: 0',
          '        activation:',
          '          time_windows: []',
          '          allowed_days: [mon, tue, wed, thu, fri, sat, sun]',
          '          trigger_conditions: []',
          '        governance: {}',
          '        constraints: {}',
          'seasonal_slots: []',
        ].join('\n'),
      )
      for (const id of ['stage-theme-01', 'stage-theme-02']) {
        writeFile(path.join(sourceDir, `templates/${id}.yaml`), makeStageTemplateYaml(id))
      }

      const scriptPath = path.join(process.cwd(), 'scripts/stage-templates-validate.mjs')
      const result = spawnSync('node', [scriptPath], { cwd: workspace, encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(result.stderr + result.stdout).toContain('Template count must be >= 50')
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })

  it('stage-season-rotate reads and writes source/dist layout', () => {
    const workspace = makeTempWorkspace()
    try {
      const sourceDir = path.join(workspace, 'docs/stage-templates/source')
      writeFile(
        path.join(sourceDir, 'manifest.yaml'),
        [
          'version: v2',
          'templates:',
          '  - id: launch-1',
          '    category: theme',
          '    path: templates/launch-1.yaml',
          '    lifecycle_status: seasonal_active',
          '    bindings:',
          ...seasonalBindingBlock('season-slot-1'),
          '  - id: launch-2',
          '    category: theme',
          '    path: templates/launch-2.yaml',
          '    lifecycle_status: seasonal_active',
          '    bindings:',
          ...seasonalBindingBlock('season-slot-2'),
          '  - id: launch-3',
          '    category: theme',
          '    path: templates/launch-3.yaml',
          '    lifecycle_status: seasonal_active',
          '    bindings:',
          ...seasonalBindingBlock('season-slot-3'),
          '  - id: hidden-1',
          '    category: theme',
          '    path: templates/hidden-1.yaml',
          '    lifecycle_status: hidden',
          '    bindings: []',
          '  - id: hidden-2',
          '    category: theme',
          '    path: templates/hidden-2.yaml',
          '    lifecycle_status: hidden',
          '    bindings: []',
          '  - id: hidden-3',
          '    category: theme',
          '    path: templates/hidden-3.yaml',
          '    lifecycle_status: hidden',
          '    bindings: []',
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
          path.join(sourceDir, `templates/${templateId}.yaml`),
          makeStageTemplateYaml(templateId, templateId === 'launch-1'),
        )
      }

      const scriptPath = path.join(process.cwd(), 'scripts/stage-season-rotate.mjs')
      const result = spawnSync('node', [scriptPath, '--open-count=3'], {
        cwd: workspace,
        encoding: 'utf8',
      })
      expect(result.status).toBe(0)

      const manifestRaw = fs.readFileSync(path.join(sourceDir, 'manifest.yaml'), 'utf8')
      expect(manifestRaw).toContain('rotation_audit:')

      const library = JSON.parse(fs.readFileSync(path.join(workspace, 'docs/stage-templates/dist/library.json'), 'utf8')) as {
        version: string
      }
      expect(library.version).toBe('v2')
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })
})
