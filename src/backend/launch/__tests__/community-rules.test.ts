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
    expect(hotArena).toBeTruthy()
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
    expect(Object.keys(hotArena?.rules_json ?? {}).sort()).toEqual([
      'cast_policy',
      'community_lifecycle_state',
      'content_contract',
      'cross_route_policy',
      'discovery_policy',
      'governance_policy',
      'launch_profile',
      'metrics_policy',
      'quality_policy',
      'scene_mix',
      'stage_spec_v1',
      't4_policy',
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
})
