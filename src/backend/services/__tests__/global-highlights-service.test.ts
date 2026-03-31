import { describe, expect, it } from 'vitest'
import { GlobalHighlightsService } from '../global-highlights-service.js'
import { getLaunchCommunityBySlug } from '../../launch/community-rules.js'

describe('GlobalHighlightsService', () => {
  it('projects highlight-card packaging metadata for launch-configured posts', async () => {
    const launchCommunity = getLaunchCommunityBySlug('hot-arena')
    const community = {
      id: 'community-1',
      slug: 'hot-arena-test',
      name: 'Hot Arena Test',
      rules_json: launchCommunity?.rules_json ?? null,
    }

    const service = new GlobalHighlightsService({
      forumReadService: {
        getFeed: async () => ({
          items: [
            {
              id: 'post-1',
              community_id: community.id,
              community_slug: community.slug,
              community_name: community.name,
              title: 'Highlight target',
              vote_score: 12,
              vote_up: 10,
              vote_down: 2,
              thread_turn_count: 5,
              participant_count: 3,
              heat_score: 88,
              last_reply_at: new Date('2026-03-31T02:00:00.000Z'),
              author: {
                id: 'agent-1',
                display_name: 'Highlight Agent',
                avatar_url: null,
              },
              media: [
                {
                  asset_id: 'asset-1',
                  media_url: '/media/asset-1.png',
                  mime_type: 'image/png',
                  alt_text: 'Highlight cover',
                },
              ],
            },
          ],
          next_cursor: null,
        }),
      } as never,
      achievementChronicleService: {
        getPublicHighlights: async () => ({
          badges: [],
          tagline: null,
          top_chronicle: [],
        }),
      } as never,
      chronicleRepo: {
        findByAgent: async () => ({
          items: [],
          next_cursor: null,
        }),
      } as never,
      communityRepo: {
        findById: (id: string) => (id === community.id ? community : null),
      } as never,
      mediaRolloutControllerService: {
        getEffectiveProfile: async () => ({
          mode: 'AUTO',
          profile: 'steady',
        }),
      },
    })

    const payload = await service.collectToday()

    expect(payload.hot_threads[0]).toMatchObject({
      surface_kind: 'highlight_card',
      card_mode: 'single_cover',
      thumbnail_policy: 'required',
      hero_eligible: true,
    })
    expect(payload.controversy[0]).toMatchObject({
      surface_kind: 'highlight_card',
      card_mode: 'single_cover',
      thumbnail_policy: 'required',
      hero_eligible: true,
    })
  })
})
