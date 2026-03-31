import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import {
  getLaunchVisualRollout,
  normalizeLaunchCardMode,
  resolveLaunchVisualPackaging,
} from '../visual-rollout.js'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const sourcePath = resolve(
  repoRoot,
  'dev-docs/active/launch-visual-rollout-and-packaging/visual_surface_rollout.v1.yaml',
)

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
    expect(runtime.thumbnail_policy.t4_root_card).toBe('required')
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

  it('normalizes legacy and T4 aliases into canonical card modes', () => {
    expect(normalizeLaunchCardMode('headline_card')).toEqual({
      input_mode: 'headline_card',
      card_mode: 'single_cover',
      hero_eligible: false,
      visual_tone: null,
    })
    expect(normalizeLaunchCardMode('note_cover')).toEqual({
      input_mode: 'note_cover',
      card_mode: 'single_cover',
      hero_eligible: false,
      visual_tone: null,
    })
    expect(normalizeLaunchCardMode('hero_cover')).toEqual({
      input_mode: 'hero_cover',
      card_mode: 'single_cover',
      hero_eligible: true,
      visual_tone: null,
    })
    expect(normalizeLaunchCardMode('grid_cover')).toEqual({
      input_mode: 'grid_cover',
      card_mode: 'multi_panel_cover',
      hero_eligible: false,
      visual_tone: null,
    })
    expect(normalizeLaunchCardMode('portrait_cover')).toEqual({
      input_mode: 'portrait_cover',
      card_mode: 'portrait_cover',
      hero_eligible: false,
      visual_tone: null,
    })
    expect(normalizeLaunchCardMode('evidence_strip')).toEqual({
      input_mode: 'evidence_strip',
      card_mode: 'strip_card',
      hero_eligible: false,
      visual_tone: null,
    })
    expect(normalizeLaunchCardMode('conflict_hero')).toEqual({
      input_mode: 'conflict_hero',
      card_mode: 'single_cover',
      hero_eligible: true,
      visual_tone: 'conflict',
    })
  })

  it('prefers intersected canonical modes and keeps hero eligibility from aliases', () => {
    const result = resolveLaunchVisualPackaging({
      surface: 'home_root_card',
      community_visual_policy: {
        preferred_visual_modes: ['headline_card', 'conflict_hero'],
      },
      has_thumbnail: true,
      content_context: {
        is_t4: false,
      },
    })

    expect(result).toEqual({
      surface_kind: 'home_root_card',
      card_mode: 'single_cover',
      thumbnail_policy: 'required_if_available',
      hero_eligible: true,
    })
  })

  it('falls back to the surface default when community modes do not intersect', () => {
    const result = resolveLaunchVisualPackaging({
      surface: 'home_root_card',
      community_visual_policy: {
        preferred_visual_modes: ['relationship_map_card'],
      },
      has_thumbnail: false,
      content_context: {
        is_t4: false,
      },
    })

    expect(result).toEqual({
      surface_kind: 'home_root_card',
      card_mode: 'single_cover',
      thumbnail_policy: 'required_if_available',
      hero_eligible: false,
    })
  })

  it('reads T4 preferred_cover_modes through the same alias normalization path', () => {
    const result = resolveLaunchVisualPackaging({
      surface: 't4_root_card',
      community_visual_policy: {
        preferred_cover_modes: ['grid_cover'],
      },
      has_thumbnail: true,
      content_context: {
        is_t4: true,
      },
    })

    expect(result).toEqual({
      surface_kind: 't4_root_card',
      card_mode: 'multi_panel_cover',
      thumbnail_policy: 'required',
      hero_eligible: false,
    })
  })

  it('drops packaging when required thumbnails are missing', () => {
    const result = resolveLaunchVisualPackaging({
      surface: 't4_root_card',
      community_visual_policy: {
        preferred_visual_modes: ['note_cover'],
      },
      has_thumbnail: false,
      content_context: {
        is_t4: true,
      },
    })

    expect(result).toBeNull()
  })

  it('only packages thread_turn cards for key turn kinds', () => {
    expect(resolveLaunchVisualPackaging({
      surface: 'thread_turn',
      community_visual_policy: {
        preferred_visual_modes: ['case_card'],
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
        preferred_visual_modes: ['case_card'],
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
        preferred_visual_modes: ['headline_card'],
      },
      has_thumbnail: true,
      rollout_profile: {
        mode: 'OFF',
        profile: 'off',
      },
      content_context: {
        is_t4: false,
      },
    })).toBeNull()

    expect(resolveLaunchVisualPackaging({
      surface: 'thread_turn',
      community_visual_policy: {
        preferred_visual_modes: ['case_card'],
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
