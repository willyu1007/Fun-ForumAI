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
    `    viewer_goal: 为 ${id} 增加导播目标`,
    '    growth_goal: 增加角色关系张力',
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

function bindingBlock(prefix = '        '): string[] {
  return [
    `${prefix}lifecycle: {}`,
    `${prefix}weights:`,
    `${prefix}  editorial_priority: 10`,
    `${prefix}  base_weight: 1`,
    `${prefix}  freshness_bonus: 1`,
    `${prefix}activation:`,
    `${prefix}  time_windows: []`,
    `${prefix}  allowed_days: [mon, tue, wed, thu, fri, sat, sun]`,
    `${prefix}  trigger_conditions: []`,
    `${prefix}governance: {}`,
    `${prefix}constraints: {}`,
  ]
}

function seedFixture(baseDir: string): void {
  writeFile(
    path.join(baseDir, 'manifest.yaml'),
    [
      'version: v2',
      'templates:',
      '  - id: launch-1',
      '    category: theme',
      '    path: templates/launch-1.yaml',
      '    lifecycle_status: seasonal_active',
      '    bindings:',
      '      - surface: forum',
      '        community_slug: season-slot-1',
      '        seasonal_slot: season-slot-1',
      '        binding_type: seasonal',
      ...bindingBlock(),
      '      - surface: chat_room',
      '        room_id: scene-pool-room-ai-consciousness',
      '        binding_type: core',
      '        lifecycle: {}',
      '        weights:',
      '          editorial_priority: 8',
      '          base_weight: 1',
      '          freshness_bonus: 0',
      '        activation:',
      '          time_windows: []',
      '          allowed_days: [mon, tue, wed, thu, fri, sat, sun]',
      '          trigger_conditions: []',
      '        governance: {}',
      '        constraints: {}',
      '  - id: launch-2',
      '    category: theme',
      '    path: templates/launch-2.yaml',
      '    lifecycle_status: seasonal_active',
      '    bindings:',
      '      - surface: forum',
      '        community_slug: season-slot-2',
      '        seasonal_slot: season-slot-2',
      '        binding_type: seasonal',
      ...bindingBlock(),
      '  - id: launch-3',
      '    category: theme',
      '    path: templates/launch-3.yaml',
      '    lifecycle_status: seasonal_active',
      '    bindings:',
      '      - surface: forum',
      '        community_slug: season-slot-3',
      '        seasonal_slot: season-slot-3',
      '        binding_type: seasonal',
      ...bindingBlock(),
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

  for (const id of ['launch-1', 'launch-2', 'launch-3', 'hidden-1', 'hidden-2', 'hidden-3']) {
    writeFile(
      path.join(baseDir, `templates/${id}.yaml`),
      makeStageTemplateYaml(id, id === 'launch-1'),
    )
  }
}

describe('stage-template-ops', () => {
  it('builds v2 dist payloads from authoring v2 source', () => {
    const workspace = makeTempWorkspace()
    try {
      const baseDir = path.join(workspace, 'docs/stage-templates/source')
      seedFixture(baseDir)
      const manifest = parseYaml(
        fs.readFileSync(path.join(baseDir, 'manifest.yaml'), 'utf8'),
      ) as StageTemplateManifest

      const dist = buildStageTemplateDistPayload(baseDir, manifest, '2026-03-13T00:00:00.000Z')

      expect(dist.library.version).toBe('v2')
      expect(dist.launch.version).toBe('v2')
      expect(dist.library.stage_templates).toHaveLength(6)
      expect(dist.launch.stage_templates).toHaveLength(3)
      expect(dist.library.scene_bindings).toHaveLength(4)
      expect(
        dist.library.scene_bindings.filter((item) =>
          typeof item === 'object'
          && item !== null
          && 'target' in item
          && typeof item.target === 'object'
          && item.target !== null
          && 'surface' in item.target
          && item.target.surface === 'chat_room',
        ),
      ).toHaveLength(1)
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })

  it('applies season rotation and writes v2 manifest/dist into source/dist layout', () => {
    const workspace = makeTempWorkspace()
    try {
      const baseDir = path.join(workspace, 'docs/stage-templates/source')
      const distDir = path.join(workspace, 'docs/stage-templates/dist')
      seedFixture(baseDir)

      const result = applySeasonRotationAtomic({
        base_dir: baseDir,
        dist_dir: distDir,
        open_count: 3,
        dry_run: false,
      })

      expect(result.dry_run).toBe(false)
      expect(result.replaced).toHaveLength(3)
      expect(result.activated).toHaveLength(3)
      expect(result.exported_templates).toBe(6)
      expect(result.launch_templates).toBe(3)

      const manifest = parseYaml(fs.readFileSync(path.join(baseDir, 'manifest.yaml'), 'utf8')) as {
        rotation_audit?: unknown[]
      }
      expect(Array.isArray(manifest.rotation_audit)).toBe(true)
      expect(manifest.rotation_audit).toHaveLength(1)

      const library = JSON.parse(fs.readFileSync(path.join(distDir, 'library.json'), 'utf8')) as {
        version: string
        scene_bindings: Array<unknown>
      }
      const launch = JSON.parse(fs.readFileSync(path.join(distDir, 'launch.json'), 'utf8')) as {
        stage_templates: Array<unknown>
        scene_bindings: Array<unknown>
      }
      expect(library.version).toBe('v2')
      expect(library.scene_bindings).toHaveLength(4)
      expect(launch.stage_templates).toHaveLength(3)
      expect(launch.scene_bindings).toHaveLength(3)
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })

  it('rolls back manifest and dist when write pipeline fails', () => {
    const workspace = makeTempWorkspace()
    try {
      const baseDir = path.join(workspace, 'docs/stage-templates/source')
      const distDir = path.join(workspace, 'docs/stage-templates/dist')
      seedFixture(baseDir)
      writeFile(path.join(distDir, 'library.json'), '{"version":"before"}\n')
      writeFile(path.join(distDir, 'launch.json'), '{"version":"before"}\n')

      const manifestBefore = fs.readFileSync(path.join(baseDir, 'manifest.yaml'), 'utf8')
      const libraryBefore = fs.readFileSync(path.join(distDir, 'library.json'), 'utf8')
      const launchBefore = fs.readFileSync(path.join(distDir, 'launch.json'), 'utf8')

      expect(() => applySeasonRotationAtomic({
        base_dir: baseDir,
        dist_dir: distDir,
        open_count: 3,
        dry_run: false,
        inject_failure_step: 'after_dist_commit',
      })).toThrow('Season rotation failed')

      const manifestAfter = fs.readFileSync(path.join(baseDir, 'manifest.yaml'), 'utf8')
      const libraryAfter = fs.readFileSync(path.join(distDir, 'library.json'), 'utf8')
      const launchAfter = fs.readFileSync(path.join(distDir, 'launch.json'), 'utf8')

      expect(manifestAfter).toBe(manifestBefore)
      expect(libraryAfter).toBe(libraryBefore)
      expect(launchAfter).toBe(launchBefore)
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  })
})
