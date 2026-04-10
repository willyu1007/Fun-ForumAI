import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import {
  getLaunchCommunityRules,
} from '../community-rules.js'
import { resolveLaunchContractPath } from '../contract-paths.js'

describe('launch community rules', () => {
  it('loads 12 launch communities and materializes final rules_json blocks', () => {
    const runtime = getLaunchCommunityRules()
    expect(runtime.communities).toHaveLength(12)
    const hotArena = runtime.communities.find((community) => community.slug === 'hot-arena')
    const creatorRecommendation = runtime.communities.find((community) => community.slug === 'creator-recommendation')
    expect(hotArena).toBeTruthy()
    expect(creatorRecommendation).toBeTruthy()
    expect(hotArena?.rules_json).toMatchObject({
      community_lifecycle_state: 'launch_core',
      launch_profile: expect.objectContaining({
        headline_priority: 100,
      }),
      stage_spec_v1: expect.objectContaining({
        version: 'v1',
        min_tier_pool: 'T2',
      }),
      cross_route_policy: expect.objectContaining({
        handoff_targets: ['banter-watch', 'weekly-headline'],
      }),
    })
    expect(creatorRecommendation?.rules_json).toMatchObject({
      content_contract: {
        authoring_shapes: ['note_root', 'aftershow_recap'],
        discussion_seed_types: [],
      },
      visual_policy: {
        preferred_card_modes: ['single_cover', 'multi_panel_cover', 'comparison_cover'],
      },
      stage_spec_v1: {
        human_participation: {
          public_participation_mode: 'open_reply',
          audience_signal_ingestion: 'none',
          agent_human_response_mode: 'direct_reply',
        },
      },
    })
    expect(Object.keys(hotArena?.rules_json ?? {}).sort()).toEqual([
      'cast_policy',
      'community_lifecycle_state',
      'content_contract',
      'creator_note_runtime',
      'cross_route_policy',
      'discovery_policy',
      'governance_policy',
      'launch_profile',
      'metrics_policy',
      'quality_policy',
      'scene_mix',
      'stage_spec_v1',
      'visual_policy',
    ])
  })

  it('rejects invalid handoff targets and out-of-range headline priority', () => {
    const source = parseYaml(
      readFileSync(
        resolveLaunchContractPath({
          bundle_slug: 'launch-communities-and-rules-pack',
          file_name: 'launch_community_rules.v1.yaml',
        }),
        'utf8',
      ),
    ) as Record<string, unknown> & {
      communities: Array<Record<string, unknown>>
    }
    const first = source.communities[0]!
    const rulesJson = first.rules_json as Record<string, unknown>
    rulesJson.launch_profile = {
      ...(rulesJson.launch_profile as Record<string, unknown>),
      headline_priority: 101,
    }
    rulesJson.cross_route_policy = {
      ...(rulesJson.cross_route_policy as Record<string, unknown>),
      handoff_targets: ['不存在的社区'],
    }

    const dir = mkdtempSync(join(tmpdir(), 'launch-community-rules-'))
    const filePath = join(dir, 'launch_community_rules.v1.yaml')
    writeFileSync(filePath, stringifyYaml(source), 'utf8')

    expect(() => getLaunchCommunityRules(filePath)).toThrowError(/Invalid launch community rules/)
  })

  it('rejects legacy community-rule aliases outside explicit migration boundaries', () => {
    const source = parseYaml(
      readFileSync(
        resolveLaunchContractPath({
          bundle_slug: 'launch-communities-and-rules-pack',
          file_name: 'launch_community_rules.v1.yaml',
        }),
        'utf8',
      ),
    ) as Record<string, unknown> & {
      communities: Array<Record<string, unknown>>
    }
    const creatorCommunity = source.communities.find((community) => community.slug === 'creator-recommendation')
    if (!creatorCommunity) {
      throw new Error('expected creator launch community')
    }
    const rulesJson = creatorCommunity.rules_json as Record<string, unknown>
    rulesJson.launch_profile = {
      headline_priority: 90,
      show_on_home: true,
      community_family: 'creator_recommendation',
      launch_wave: 'launch_core',
      default_editorial_shelf_ids: ['notes_today'],
    }
    rulesJson.content_contract = {
      ...(rulesJson.content_contract as Record<string, unknown>),
      allowed_content_shapes: ['note_root', 'aftershow_recap'],
    }
    delete (rulesJson.content_contract as Record<string, unknown>).authoring_shapes

    const dir = mkdtempSync(join(tmpdir(), 'launch-community-rules-'))
    const filePath = join(dir, 'launch_community_rules.v1.yaml')
    writeFileSync(filePath, stringifyYaml(source), 'utf8')

    expect(() => getLaunchCommunityRules(filePath)).toThrowError(/allowed_content_shapes is no longer accepted/)
  })

  it('rejects legacy preferred_visual_modes in community visual policy', () => {
    const source = parseYaml(
      readFileSync(
        resolveLaunchContractPath({
          bundle_slug: 'launch-communities-and-rules-pack',
          file_name: 'launch_community_rules.v1.yaml',
        }),
        'utf8',
      ),
    ) as Record<string, unknown> & {
      communities: Array<Record<string, unknown>>
    }
    const first = source.communities[0]!
    const rulesJson = first.rules_json as Record<string, unknown>
    rulesJson.visual_policy = {
      ...(rulesJson.visual_policy as Record<string, unknown>),
      preferred_visual_modes: ['headline_card'],
    }

    const dir = mkdtempSync(join(tmpdir(), 'launch-community-rules-'))
    const filePath = join(dir, 'launch_community_rules.v1.yaml')
    writeFileSync(filePath, stringifyYaml(source), 'utf8')

    expect(() => getLaunchCommunityRules(filePath)).toThrowError(/preferred_visual_modes is no longer accepted/)
  })

  it('rejects community preferred_cover_modes compat fields', () => {
    const source = parseYaml(
      readFileSync(
        resolveLaunchContractPath({
          bundle_slug: 'launch-communities-and-rules-pack',
          file_name: 'launch_community_rules.v1.yaml',
        }),
        'utf8',
      ),
    ) as Record<string, unknown> & {
      communities: Array<Record<string, unknown>>
    }
    const first = source.communities[0]!
    const rulesJson = first.rules_json as Record<string, unknown>
    rulesJson.visual_policy = {
      ...(rulesJson.visual_policy as Record<string, unknown>),
      preferred_cover_modes: ['single_cover'],
    }

    const dir = mkdtempSync(join(tmpdir(), 'launch-community-rules-'))
    const filePath = join(dir, 'launch_community_rules.v1.yaml')
    writeFileSync(filePath, stringifyYaml(source), 'utf8')

    expect(() => getLaunchCommunityRules(filePath)).toThrowError(/preferred_cover_modes is no longer accepted/)
  })

  it('rejects unknown authoring_shapes instead of silently filtering them', () => {
    const source = parseYaml(
      readFileSync(
        resolveLaunchContractPath({
          bundle_slug: 'launch-communities-and-rules-pack',
          file_name: 'launch_community_rules.v1.yaml',
        }),
        'utf8',
      ),
    ) as Record<string, unknown> & {
      communities: Array<Record<string, unknown>>
    }
    const first = source.communities[0]!
    const rulesJson = first.rules_json as Record<string, unknown>
    rulesJson.content_contract = {
      ...(rulesJson.content_contract as Record<string, unknown>),
      authoring_shapes: ['discussion_root', 'highlight_card'],
    }

    const dir = mkdtempSync(join(tmpdir(), 'launch-community-rules-'))
    const filePath = join(dir, 'launch_community_rules.v1.yaml')
    writeFileSync(filePath, stringifyYaml(source), 'utf8')

    expect(() => getLaunchCommunityRules(filePath)).toThrowError(/authoring_shapes\[1\] must resolve to a canonical authoring shape/)
  })
})
