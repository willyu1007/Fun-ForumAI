import { describe, expect, it, vi } from 'vitest'
import { GlobalHighlightsService } from '../global-highlights-service.js'

describe('GlobalHighlightsService', () => {
  it('carries display_badges into featured_agents so frontstage identity chips stay aligned', async () => {
    const service = new GlobalHighlightsService({
      forumReadService: {
        getFeed: vi.fn().mockResolvedValue({
          items: [{
            id: 'post-1',
            community_id: 'community-1',
            community_name: 'Community 1',
            community_slug: 'community-1',
            title: 'Hero thread',
            created_at: '2026-04-07T08:00:00.000Z',
            updated_at: '2026-04-07T08:00:00.000Z',
            vote_score: 42,
            thread_turn_count: 8,
            participant_count: 5,
            heat_score: 99,
            last_reply_at: new Date('2026-04-07T08:00:00.000Z'),
            author: {
              id: 'agent-1',
              display_name: 'Agent 1',
              avatar_url: null,
              public_identity: {
                agent_kind: 'system',
                identity_badges: [
                  {
                    badge_id: 'identity:system_host_badge',
                    internal_code: 'system_host_badge',
                    label: '主持席',
                    source_kind: 'system_display',
                    priority_rank: 225,
                  },
                ],
              },
              display_badges: ['主持席'],
            },
            media: [],
          }],
        }),
      } as never,
      achievementChronicleService: {
        getPublicHighlights: vi.fn().mockResolvedValue({
          badges: [{ code: 'highlight_headliner', name: '今日必看', tier: 1 }],
          tagline: 'highlights tagline',
          top_chronicle: [],
        }),
      } as never,
      chronicleRepo: {
        findByAgent: vi.fn().mockResolvedValue({ items: [], next_cursor: null }),
      } as never,
      communityRepo: {
        findById: vi.fn().mockReturnValue(null),
      } as never,
      agentBioService: {
        getProjection: vi.fn().mockResolvedValue({ public_bio: 'public bio' }),
      } as never,
    })

    const payload = await service.collectToday()

    expect(payload.featured_agents).toEqual([
      expect.objectContaining({
        agent_id: 'agent-1',
        public_identity: expect.objectContaining({
          identity_badges: [
            expect.objectContaining({
              label: '主持席',
            }),
          ],
        }),
        public_proof: {
          achievement_badges: [{ code: 'highlight_headliner', name: '今日必看', level: 1 }],
        },
        display_badges: ['主持席'],
        badges: [{ code: 'highlight_headliner', name: '今日必看', tier: 1 }],
      }),
    ])
  })
})
