import { describe, expect, it } from 'vitest'
import { getLaunchCommunityBySlug, resolveLaunchCommunityInteractionContract, resolveLaunchCommunitySemanticContract } from '../community-rules.js'
import { getSemanticTaxonomyRegistry } from '../semantic-taxonomy-registry.js'
import {
  normalizeCommunityFamily,
  normalizeContentKind,
  normalizeEditorialShelfId,
  normalizeIdentityRoleId,
} from '../../../shared/semantic-taxonomy.js'

describe('semantic taxonomy registry', () => {
  it('loads the wave-1 registry set with exact coverage', () => {
    const registry = getSemanticTaxonomyRegistry()

    expect(registry.community_families.shell_categories.map((entry) => entry.id)).toEqual([
      'theme',
      'show',
      'world',
      'creator',
    ])
    expect(registry.community_families.families).toHaveLength(12)
    expect(registry.publication_review_profiles.profiles.map((entry) => entry.id)).toEqual([
      'standard_publication',
      'creator_strict_publication',
    ])
    expect(registry.editorial_shelves.shelves.map((entry) => entry.id)).toEqual([
      'must_watch_today',
      'conflict_rising',
      'notes_today',
      'continue_storyline',
      'tonight_programming',
      'all_communities',
    ])
    expect(registry.content_formats.content_kinds.map((entry) => entry.id)).toContain('note_entry')
  })

  it('normalizes canonical semantic ids and retained format aliases', () => {
    expect(normalizeCommunityFamily('creator_recommendation')).toBe('creator_recommendation')
    expect(normalizeEditorialShelfId('notes_today')).toBe('notes_today')
    expect(normalizeContentKind('note_entry')).toBe('note_entry')
    expect(normalizeIdentityRoleId('creator')).toBe('creator')
    expect(normalizeIdentityRoleId('t4_blogger')).toBeNull()
  })

  it('resolves canonical community and interaction contracts for launch communities', () => {
    const picks = getLaunchCommunityBySlug('creator-recommendation')
    expect(picks).not.toBeNull()
    if (!picks) return

    expect(resolveLaunchCommunitySemanticContract(picks.rules_json)).toMatchObject({
      community_family: 'creator_recommendation',
      community_shell_category: 'creator',
      publication_review_profile_id: 'creator_strict_publication',
      default_editorial_shelf_ids: ['notes_today'],
    })
    expect(resolveLaunchCommunityInteractionContract(picks.rules_json)).toMatchObject({
      public_participation_mode: 'open_reply',
      audience_signal_ingestion: 'none',
      agent_human_response_mode: 'direct_reply',
    })
  })

  it('does not fail read paths when a community carries non-launch rules', () => {
    expect(resolveLaunchCommunitySemanticContract({
      community_lifecycle_state: 'incubating_gray',
      launch_profile: {
        community_family: 'graybox_experiment',
      },
      content_contract: {
        authoring_shapes: ['discussion_root'],
      },
    })).toBeNull()
  })
})
