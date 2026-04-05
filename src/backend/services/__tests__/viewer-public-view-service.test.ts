import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryViewerPublicViewEventRepository } from '../../repos/viewer-public-view-event-repository.js'
import { ViewerPublicViewService } from '../viewer-public-view-service.js'

describe('ViewerPublicViewService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-31T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('purges expired public view events before recording fresh ones', async () => {
    const repo = new InMemoryViewerPublicViewEventRepository()
    const service = new ViewerPublicViewService(repo)

    await repo.createMany([{
      actor_type: 'VISITOR',
      actor_id: 'visitor-1',
      source_surface: 'feed',
      target_kind: 'post_detail',
      target_id: 'post-expired',
      storyline_id: 'story-expired',
      occurred_at: new Date('2026-03-10T08:00:00.000Z'),
    }])

    await service.record([{
      actor_type: 'VISITOR',
      actor_id: 'visitor-1',
      viewer_agent_id: 'viewer-agent-1',
      source_surface: 'feed',
      source_shelf: 'continue_storyline',
      source_position: 0,
      target_kind: 'post_detail',
      target_id: 'post-fresh',
      target_agent_id: 'agent-fresh',
      community_id: 'community-hot',
      storyline_id: 'story-fresh',
      occurred_at: new Date('2026-03-31T11:00:00.000Z'),
    }])

    const rows = await repo.listRecentByActor(
      [{ actor_type: 'VISITOR', actor_id: 'visitor-1' }],
      { since: new Date('2026-03-01T00:00:00.000Z'), limit: 10 },
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      target_id: 'post-fresh',
      storyline_id: 'story-fresh',
      source_shelf: 'continue_storyline',
    })
  })

  it('merges visitor history into the user recent signal projection', async () => {
    const repo = new InMemoryViewerPublicViewEventRepository()
    const service = new ViewerPublicViewService(repo)

    await repo.createMany([
      {
        actor_type: 'VISITOR',
        actor_id: 'visitor-1',
        viewer_agent_id: 'viewer-agent-1',
        source_surface: 'home',
        target_kind: 'post_detail',
        target_id: 'post-visitor',
        target_agent_id: 'agent-visitor',
        community_id: 'community-hot',
        storyline_id: 'story-visitor',
        occurred_at: new Date('2026-03-30T08:00:00.000Z'),
      },
      {
        actor_type: 'USER',
        actor_id: 'user-1',
        viewer_user_id: 'user-1',
        viewer_agent_id: 'viewer-agent-1',
        source_surface: 'highlights',
        target_kind: 'highlight_post',
        target_id: 'post-user',
        target_agent_id: 'agent-user',
        community_id: 'community-t4',
        storyline_id: 'story-user',
        is_t4: true,
        note_template_id: 'comparison_note',
        occurred_at: new Date('2026-03-31T09:00:00.000Z'),
      },
    ])

    await service.mergeVisitorIntoUser('visitor-1', 'user-1')

    const signals = await service.getRecentSignals({
      actor_type: 'USER',
      actor_id: 'user-1',
      user_id: 'user-1',
      viewer_agent_id: 'viewer-agent-1',
    })

    expect(signals.actor_keys).toEqual(['USER:user-1'])
    expect(signals.recent_storyline_ids).toEqual(['story-user', 'story-visitor'])
    expect(signals.recent_community_ids).toEqual(['community-t4', 'community-hot'])
    expect(signals.recent_note_template_ids).toEqual(['comparison_note'])
    expect(signals.recent_target_agent_ids).toEqual(['agent-user', 'agent-visitor'])
    expect(signals.explainability).toEqual([
      'recent_storyline_revisit:story-user,story-visitor',
      'recent_note_template_revisit:comparison_note',
      'recent_agent_touch:agent-user,agent-visitor',
    ])
  })
})
