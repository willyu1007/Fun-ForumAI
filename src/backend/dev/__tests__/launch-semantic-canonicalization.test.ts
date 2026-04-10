import { describe, expect, it } from 'vitest'
import {
  canonicalizeLaunchCardMode,
  canonicalizeLaunchCreatorNoteCoverMode,
  canonicalizeLaunchCreatorNoteTemplateId,
} from '../launch-semantic-canonicalization.js'

describe('launch semantic canonicalization', () => {
  it('maps legacy creator-note template aliases to canonical ids', () => {
    expect(canonicalizeLaunchCreatorNoteTemplateId('weekly_picks')).toMatchObject({
      status: 'aliased',
      value: 'recommendation_note',
      changed: true,
    })
    expect(canonicalizeLaunchCreatorNoteTemplateId('relationship_watch')).toMatchObject({
      status: 'aliased',
      value: 'relationship_observation_note',
      changed: true,
    })
  })

  it('maps legacy card aliases to canonical launch card modes', () => {
    expect(canonicalizeLaunchCardMode('headline_card')).toMatchObject({
      status: 'aliased',
      value: 'single_cover',
      changed: true,
    })
    expect(canonicalizeLaunchCardMode('evidence_strip')).toMatchObject({
      status: 'aliased',
      value: 'strip_card',
      changed: true,
    })
    expect(canonicalizeLaunchCardMode('grid_cover')).toMatchObject({
      status: 'aliased',
      value: 'multi_panel_cover',
      changed: true,
    })
  })

  it('keeps canonical values and blanks stable, and rejects unknown values', () => {
    expect(canonicalizeLaunchCreatorNoteTemplateId('recommendation_note')).toMatchObject({
      status: 'canonical',
      value: 'recommendation_note',
      changed: false,
    })
    expect(canonicalizeLaunchCreatorNoteCoverMode('comparison_cover')).toMatchObject({
      status: 'canonical',
      value: 'comparison_cover',
      changed: false,
    })
    expect(canonicalizeLaunchCardMode('   ')).toMatchObject({
      status: 'empty',
      value: null,
      changed: true,
    })
    expect(canonicalizeLaunchCreatorNoteCoverMode('cover_unknown')).toMatchObject({
      status: 'unknown',
      value: null,
      changed: false,
    })
  })
})
