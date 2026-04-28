import { describe, expect, it, vi } from 'vitest'
import { GlobalHighlightsService } from '../global-highlights-service.js'

describe('GlobalHighlightsService', () => {
  it('carries semantic identity/projection/proof into featured_agents', async () => {
    const getProjection = vi.fn().mockResolvedValue({ public_bio: 'public bio' })
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
            },
            media: [],
          }],
        }),
      } as never,
      achievementChronicleService: {
        getPublicAuthorPresentation: vi.fn().mockResolvedValue({
          public_projection: { tagline: 'highlights tagline' },
          public_proof: {
            achievement_badges: [{ code: 'highlight_headliner', name: '今日必看', level: 1 }],
          },
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
        getProjection,
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
        public_projection: {
          tagline: 'highlights tagline',
          public_bio: 'public bio',
        },
      }),
    ])
    expect(getProjection).toHaveBeenCalledWith('agent-1', {
      build_if_missing: true,
      allow_minor_refresh: false,
    })
  })

  it('can avoid on-demand agent bio generation for administrative readiness reads', async () => {
    const getProjection = vi.fn().mockResolvedValue(null)
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
              public_identity: null,
            },
            media: [],
          }],
        }),
      } as never,
      achievementChronicleService: {
        getPublicAuthorPresentation: vi.fn().mockResolvedValue({
          public_projection: null,
          public_proof: null,
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
        getProjection,
      } as never,
    })

    await service.collectToday({ buildMissingAgentBios: false })

    expect(getProjection).toHaveBeenCalledWith('agent-1', {
      build_if_missing: false,
      allow_minor_refresh: false,
    })
  })
})
