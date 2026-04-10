import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import {
  getLaunchVisualRollout,
  normalizeLaunchCardMode,
  resolveLaunchVisualPackaging,
} from '../visual-rollout.js'
import { resolveLaunchContractPath } from '../contract-paths.js'

const sourcePath = resolveLaunchContractPath({
  bundle_slug: 'launch-visual-rollout-and-packaging',
  file_name: 'visual_surface_rollout.v1.yaml',
})

function withVisualRolloutDraft(
  mutate: (draft: Record<string, unknown>) => void,
): string {
  const source = parseYaml(readFileSync(sourcePath, 'utf8')) as Record<string, unknown>
  mutate(source)
  const dir = mkdtempSync(join(tmpdir(), 'launch-visual-rollout-'))
  const filePath = join(dir, 'visual_surface_rollout.v1.yaml')
  writeFileSync(filePath, stringifyYaml(source), 'utf8')
  return filePath
}

describe('launch visual rollout', () => {
  it('loads the canonical launch visual rollout contract', () => {
    const runtime = getLaunchVisualRollout()

    expect(runtime.surface_rollout.home_root_card.prefer_modes).toEqual([
      'single_cover',
      'quote_card',
    ])
    expect(runtime.card_modes.map((item) => item.id)).toContain('multi_panel_cover')
    expect(runtime.hero_rules.highlight_card).toEqual({
      hero_required: true,
      requires_hero_eligible: true,
    })
    expect(runtime.thumbnail_policy.note_root_card).toBe('required')
  })

  it('rejects drafts that miss a required surface', () => {
    const filePath = withVisualRolloutDraft((draft) => {
      delete (draft.surface_rollout as Record<string, unknown>).highlight_card
    })

    expect(() => getLaunchVisualRollout(filePath)).toThrowError(/Invalid launch visual rollout/)
  })

  it('rejects drafts with out-of-range target ratios', () => {
    const filePath = withVisualRolloutDraft((draft) => {
      const surfaceRollout = draft.surface_rollout as Record<string, Record<string, unknown>>
      surfaceRollout.home_root_card = {
        ...surfaceRollout.home_root_card,
        target_ratio: 1.2,
      }
    })

    expect(() => getLaunchVisualRollout(filePath)).toThrowError(/Invalid launch visual rollout/)
  })

  it('rejects hero-flavored modes inside the canonical card_modes list', () => {
    const filePath = withVisualRolloutDraft((draft) => {
      const cardModes = draft.card_modes as Array<Record<string, unknown>>
      cardModes[0] = {
        ...cardModes[0],
        id: 'conflict_hero',
      }
    })

    expect(() => getLaunchVisualRollout(filePath)).toThrowError(/Invalid launch visual rollout/)
  })

  it('rejects drafts that omit required rollout sections', () => {
    const missingCardModesPath = withVisualRolloutDraft((draft) => {
      delete draft.card_modes
    })
    const missingHeroRulesPath = withVisualRolloutDraft((draft) => {
      delete draft.hero_rules
    })
    const missingThumbnailPolicyPath = withVisualRolloutDraft((draft) => {
      delete draft.thumbnail_policy
    })

    expect(() => getLaunchVisualRollout(missingCardModesPath)).toThrowError(/Invalid launch visual rollout/)
    expect(() => getLaunchVisualRollout(missingHeroRulesPath)).toThrowError(/Invalid launch visual rollout/)
    expect(() => getLaunchVisualRollout(missingThumbnailPolicyPath)).toThrowError(/Invalid launch visual rollout/)
  })

  it('accepts only canonical launch card modes', () => {
    expect(normalizeLaunchCardMode('headline_card')).toBeNull()
    expect(normalizeLaunchCardMode('note_cover')).toBeNull()
    expect(normalizeLaunchCardMode('hero_cover')).toBeNull()
    expect(normalizeLaunchCardMode('grid_cover')).toBeNull()
    expect(normalizeLaunchCardMode('portrait_cover')).toEqual({
      input_mode: 'portrait_cover',
      card_mode: 'portrait_cover',
      hero_eligible: false,
      visual_tone: null,
    })
    expect(normalizeLaunchCardMode('evidence_strip')).toBeNull()
    expect(normalizeLaunchCardMode('conflict_hero')).toBeNull()
  })

  it('prefers intersected canonical community card modes', () => {
    const result = resolveLaunchVisualPackaging({
      surface: 'home_root_card',
      community_visual_policy: {
        preferred_card_modes: ['single_cover'],
      },
      has_thumbnail: true,
      content_context: {
        is_creator_note: false,
      },
    })

    expect(result).toEqual({
      surface_kind: 'home_root_card',
      card_mode: 'single_cover',
      thumbnail_policy: 'required_if_available',
      hero_eligible: false,
    })
  })

  it('falls back to the surface default when community modes do not intersect', () => {
    const result = resolveLaunchVisualPackaging({
      surface: 'home_root_card',
      community_visual_policy: {
        preferred_card_modes: ['relationship_map_card'],
      },
      has_thumbnail: false,
      content_context: {
        is_creator_note: false,
      },
    })

    expect(result).toEqual({
      surface_kind: 'home_root_card',
      card_mode: 'single_cover',
      thumbnail_policy: 'required_if_available',
      hero_eligible: false,
    })
  })

  it('rejects creator-note preferred_cover_modes on community visual policy', () => {
    expect(() => resolveLaunchVisualPackaging({
      surface: 'note_root_card',
      community_visual_policy: {
        preferred_cover_modes: ['grid_cover'],
      },
      has_thumbnail: true,
      content_context: {
        is_creator_note: true,
      },
    })).toThrowError(/preferred_cover_modes is no longer accepted/)
  })

  it('drops packaging when required thumbnails are missing', () => {
    const result = resolveLaunchVisualPackaging({
      surface: 'note_root_card',
      community_visual_policy: {
        preferred_card_modes: ['single_cover'],
      },
      has_thumbnail: false,
      content_context: {
        is_creator_note: true,
      },
    })

    expect(result).toBeNull()
  })

  it('only packages thread_turn cards for key turn kinds', () => {
    expect(resolveLaunchVisualPackaging({
      surface: 'thread_turn',
      community_visual_policy: {
        preferred_card_modes: ['quote_card'],
      },
      has_thumbnail: false,
      content_context: {
        thread_turn_kind: 'turn_peak',
      },
    })).toEqual({
      surface_kind: 'thread_turn',
      card_mode: 'quote_card',
      thumbnail_policy: 'optional',
      hero_eligible: false,
    })

    expect(resolveLaunchVisualPackaging({
      surface: 'thread_turn',
      community_visual_policy: {
        preferred_card_modes: ['quote_card'],
      },
      has_thumbnail: false,
      content_context: {
        thread_turn_kind: null,
      },
    })).toBeNull()
  })

  it('falls back to text-first when controller hardening disables the surface', () => {
    expect(resolveLaunchVisualPackaging({
      surface: 'home_root_card',
      community_visual_policy: {
        preferred_card_modes: ['single_cover'],
      },
      has_thumbnail: true,
      rollout_profile: {
        mode: 'OFF',
        profile: 'off',
      },
      content_context: {
        is_creator_note: false,
      },
    })).toBeNull()

    expect(resolveLaunchVisualPackaging({
      surface: 'thread_turn',
      community_visual_policy: {
        preferred_card_modes: ['quote_card'],
      },
      has_thumbnail: false,
      rollout_profile: {
        mode: 'AUTO',
        profile: 'conserve',
      },
      content_context: {
        thread_turn_kind: 'quoteable',
      },
    })).toBeNull()
  })
})
