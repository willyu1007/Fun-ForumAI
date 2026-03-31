import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryHumanFollowRepository } from '../../repos/human-follow-repository.js'
import { InMemoryPprSnapshotRepository } from '../../repos/ppr-snapshot-repository.js'
import { PublicAgentRelationSummaryService } from '../public-agent-relation-summary-service.js'

describe('PublicAgentRelationSummaryService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-31T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('builds a viewer-facing relation summary from recent signals, follow state, and chronicle activity', async () => {
    const followRepo = new InMemoryHumanFollowRepository()
    const pprRepo = new InMemoryPprSnapshotRepository()
    const viewerPublicViewService = {
      getRecentSignals: vi.fn().mockResolvedValue({
        actor_keys: ['USER:user-1'],
        recent_storyline_ids: ['story-shared', 'story-other'],
        recent_community_ids: ['community-hot'],
        recent_t4_template_ids: ['comparison_note'],
        recent_target_agent_ids: ['agent-target'],
        explainability: ['recent_storyline_revisit:story-shared'],
      }),
    }

    vi.setSystemTime(new Date('2026-03-30T10:00:00.000Z'))
    await followRepo.follow({
      user_id: 'user-1',
      agent_id: 'agent-target',
    })
    vi.setSystemTime(new Date('2026-03-31T12:00:00.000Z'))

    await pprRepo.replaceSourceSnapshots('viewer-agent-1', [{
      source_agent_id: 'viewer-agent-1',
      candidate_agent_id: 'agent-target',
      community_id: 'community-hot',
      topic_key: 'story-shared',
      ppr_score: 0.82,
      rank: 1,
      computed_at: new Date('2026-03-31T11:00:00.000Z'),
      expires_at: new Date('2026-04-02T00:00:00.000Z'),
    }])

    const service = new PublicAgentRelationSummaryService({
      viewerPublicViewService: viewerPublicViewService as never,
      forumReadService: {
        getFeed: vi.fn().mockResolvedValue({
          items: [
            { id: 'post-1', storyline_id: 'story-shared' },
            { id: 'post-2', storyline_id: 'story-fresh' },
          ],
          next_cursor: null,
        }),
      } as never,
      achievementChronicleService: {
        getPublicHighlights: vi.fn().mockResolvedValue({
          badges: [],
          tagline: null,
          top_chronicle: [{
            id: 'chronicle-1',
            title: 'recent chronicle',
            summary: 'Target agent had a recent public callout',
            occurred_at: new Date('2026-03-30T20:00:00.000Z'),
            importance_score: 0.91,
          }],
        }),
      } as never,
      humanFollowRepo: followRepo,
      relationService: {
        getPairHintSync: () => 'following',
      } as never,
      pprSnapshotRepo: pprRepo,
    })

    const summary = await service.buildPublicSummary({
      target_agent_id: 'agent-target',
      viewer: {
        actor_type: 'USER',
        actor_id: 'user-1',
        user_id: 'user-1',
        viewer_agent_id: 'viewer-agent-1',
      },
    })

    expect(summary).toMatchObject({
      target_agent_id: 'agent-target',
      viewer_agent_id: 'viewer-agent-1',
      relation_label: '已关注',
      relation_state_delta: 'new_follow',
      shared_storyline_count: 1,
      recent_callout_presence: true,
      recent_ppr_candidates: ['agent-target'],
      cta_target: 'agent://agent/agent-target?mode=readonly&tab=social',
    })
    expect(summary?.explainability).toContain('recent_storyline_revisit:story-shared')
    expect(summary?.explainability).toContain('shared_storyline_count:1')
    expect(summary?.explainability).toContain('recent_callout_presence:true')
  })
})
