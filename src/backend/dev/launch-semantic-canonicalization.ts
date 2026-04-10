import {
  LAUNCH_CREATOR_NOTE_COVER_MODE_IDS,
  LAUNCH_CREATOR_NOTE_TEMPLATE_IDS,
  type LaunchCreatorNoteCoverMode,
  type LaunchCreatorNoteTemplateId,
} from '../launch/creator-note-templates.js'
import {
  LAUNCH_CARD_MODES,
  type LaunchCardMode,
} from '../launch/visual-rollout.js'

export const LEGACY_LAUNCH_CREATOR_NOTE_TEMPLATE_ALIASES = {
  recommendation_list: 'recommendation_note',
  weekly_picks: 'recommendation_note',
  relationship_watch: 'relationship_observation_note',
  mood_shift_log: 'relationship_observation_note',
  pair_dynamic_recap: 'ongoing_column_note',
} as const satisfies Record<string, LaunchCreatorNoteTemplateId>

export const LEGACY_LAUNCH_CARD_MODE_ALIASES = {
  headline_card: 'single_cover',
  note_cover: 'single_cover',
  minimal_cover: 'single_cover',
  story_card: 'single_cover',
  weekly_cover: 'single_cover',
  event_cover: 'single_cover',
  promo_card: 'single_cover',
  t4_note_card: 'single_cover',
  hero_cover: 'single_cover',
  conflict_hero: 'single_cover',
  list_card: 'multi_panel_cover',
  grid_cover: 'multi_panel_cover',
  carousel: 'multi_panel_cover',
  case_card: 'quote_card',
  drama_card: 'quote_card',
  argument_card: 'quote_card',
  evidence_strip: 'strip_card',
  observation_strip: 'strip_card',
} as const satisfies Record<string, LaunchCardMode>

export type CanonicalizationResult<T extends string> =
  | {
      status: 'empty'
      value: null
      changed: boolean
      original: string | null
    }
  | {
      status: 'canonical' | 'aliased'
      value: T
      changed: boolean
      original: string
    }
  | {
      status: 'unknown'
      value: null
      changed: false
      original: string
    }

function canonicalizeLaunchValue<T extends string>(input: unknown, options: {
  canonical_ids: readonly T[]
  alias_map?: Record<string, T>
}): CanonicalizationResult<T> {
  if (input === null || input === undefined) {
    return {
      status: 'empty',
      value: null,
      changed: false,
      original: null,
    }
  }

  if (typeof input !== 'string') {
    return {
      status: 'unknown',
      value: null,
      changed: false,
      original: String(input),
    }
  }

  const trimmed = input.trim()
  if (trimmed.length === 0) {
    return {
      status: 'empty',
      value: null,
      changed: input.length > 0,
      original: input,
    }
  }

  if ((options.canonical_ids as readonly string[]).includes(trimmed)) {
    return {
      status: 'canonical',
      value: trimmed as T,
      changed: trimmed !== input,
      original: input,
    }
  }

  const aliased = options.alias_map?.[trimmed]
  if (aliased) {
    return {
      status: 'aliased',
      value: aliased,
      changed: true,
      original: trimmed,
    }
  }

  return {
    status: 'unknown',
    value: null,
    changed: false,
    original: trimmed,
  }
}

export function canonicalizeLaunchCreatorNoteTemplateId(
  input: unknown,
): CanonicalizationResult<LaunchCreatorNoteTemplateId> {
  return canonicalizeLaunchValue(input, {
    canonical_ids: LAUNCH_CREATOR_NOTE_TEMPLATE_IDS,
    alias_map: LEGACY_LAUNCH_CREATOR_NOTE_TEMPLATE_ALIASES,
  })
}

export function canonicalizeLaunchCreatorNoteCoverMode(
  input: unknown,
): CanonicalizationResult<LaunchCreatorNoteCoverMode> {
  return canonicalizeLaunchValue(input, {
    canonical_ids: LAUNCH_CREATOR_NOTE_COVER_MODE_IDS,
  })
}

export function canonicalizeLaunchCardMode(
  input: unknown,
): CanonicalizationResult<LaunchCardMode> {
  return canonicalizeLaunchValue(input, {
    canonical_ids: LAUNCH_CARD_MODES,
    alias_map: LEGACY_LAUNCH_CARD_MODE_ALIASES,
  })
}
