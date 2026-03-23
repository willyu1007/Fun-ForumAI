import { describe, expect, it } from 'vitest'
import { InMemoryRelationRepository } from '../../repos/relation-repository.js'
import { InMemoryAgentRepository, InMemoryAgentConfigRepository } from '../../repos/agent-repository.js'
import { InMemoryAgentRunRepository } from '../../repos/event-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryCommentRepository } from '../../repos/comment-repository.js'
import { AgentService } from '../agent-service.js'
import { RelationService } from '../relation-service.js'

function setup() {
  const agentRepo = new InMemoryAgentRepository()
  const configRepo = new InMemoryAgentConfigRepository()
  const runRepo = new InMemoryAgentRunRepository()

  const agentA = agentRepo.create({ owner_id: 'u1', display_name: 'A' })
  const agentB = agentRepo.create({ owner_id: 'u2', display_name: 'B' })

  configRepo.create({
    agent_id: agentA.id,
    config_json: { style: { mood: 'calm', formality: 3, verbosity: 3, habits: ['logic'] } },
    updated_by: 'u1',
  })
  configRepo.create({
    agent_id: agentB.id,
    config_json: { style: { mood: 'calm', formality: 3, verbosity: 3, habits: ['logic'] } },
    updated_by: 'u2',
  })

  const relationRepo = new InMemoryRelationRepository()
  const agentService = new AgentService({
    agentRepo,
    agentConfigRepo: configRepo,
    agentRunRepo: runRepo,
  })

  const relationService = new RelationService({
    relationRepo,
    agentRepo,
    agentService,
  })

  return {
    relationRepo,
    relationService,
    agentA,
    agentB,
  }
}

describe('RelationService', () => {
  it('creates shadow relation when interaction gates are met', async () => {
    const { relationService, agentA, agentB } = setup()

    for (let i = 0; i < 12; i++) {
      await relationService.ingestSignal({
        from_agent_id: agentA.id,
        to_agent_id: agentB.id,
        event_type: 'co_presence',
        source_type: 'room_message',
        source_ref_id: `msg-cp-${i}`,
        idempotency_key: `cp:${i}`,
      })
    }

    for (let i = 0; i < 8; i++) {
      await relationService.ingestSignal({
        from_agent_id: agentA.id,
        to_agent_id: agentB.id,
        event_type: 'reciprocal_reply',
        source_type: 'room_message',
        source_ref_id: `msg-rr-${i}`,
        idempotency_key: `rr:${i}`,
      })
    }

    const following = await relationService.listRelations(agentA.id, {
      view: 'following',
      limit: 20,
    })

    expect(following.items.length).toBeGreaterThan(0)
    expect(following.items[0].pair_agent_id).toBe(agentB.id)
    expect(following.items[0].state).toBe('shadow')
  })

  it('tracks dedup hits for repeated idempotency keys', async () => {
    const { relationService, agentA, agentB } = setup()

    await relationService.ingestSignal({
      from_agent_id: agentA.id,
      to_agent_id: agentB.id,
      event_type: 'co_presence',
      source_type: 'room_message',
      source_ref_id: 'msg-1',
      idempotency_key: 'dup-key',
    })

    await relationService.ingestSignal({
      from_agent_id: agentA.id,
      to_agent_id: agentB.id,
      event_type: 'co_presence',
      source_type: 'room_message',
      source_ref_id: 'msg-1',
      idempotency_key: 'dup-key',
    })

    const metrics = relationService.getMetrics().snapshot()
    expect(metrics.relation_dedup_hit_total).toBeGreaterThanOrEqual(1)
  })

  it('returns mutual effective relations in friends view', async () => {
    const { relationRepo, relationService, agentA, agentB } = setup()

    await relationRepo.upsertRelation({
      from_agent_id: agentA.id,
      to_agent_id: agentB.id,
      state: 'effective',
      relation_score: 0.8,
      interaction_score: 0.8,
      persona_score: 0.8,
      safety_score: 1,
      effective_at: new Date(),
      shadow_started_at: new Date(),
      last_state_changed_at: new Date(),
    })

    await relationRepo.upsertRelation({
      from_agent_id: agentB.id,
      to_agent_id: agentA.id,
      state: 'effective',
      relation_score: 0.8,
      interaction_score: 0.8,
      persona_score: 0.8,
      safety_score: 1,
      effective_at: new Date(),
      shadow_started_at: new Date(),
      last_state_changed_at: new Date(),
    })

    const friends = await relationService.listRelations(agentA.id, {
      view: 'friends',
      limit: 20,
    })

    expect(friends.items).toHaveLength(1)
    expect(friends.items[0].pair_agent_id).toBe(agentB.id)

    const summary = await relationService.getSummary(agentA.id)
    expect(summary.friends).toBe(1)
  })

  it('moves relation to blocked on severe safety event', async () => {
    const { relationService, agentA, agentB } = setup()

    await relationService.ingestSignal({
      from_agent_id: agentA.id,
      to_agent_id: agentB.id,
      event_type: 'safety_severe',
      source_type: 'moderation',
      source_ref_id: 'risk-1',
      idempotency_key: 'severe-1',
    })

    const following = await relationService.listRelations(agentA.id, {
      view: 'following',
      limit: 20,
    })

    expect(following.items[0].state).toBe('blocked')
  })

  it('maps thread creation to a forum_thread reply against the post author', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const configRepo = new InMemoryAgentConfigRepository()
    const runRepo = new InMemoryAgentRunRepository()
    const relationRepo = new InMemoryRelationRepository()
    const postRepo = new InMemoryPostRepository()
    const commentRepo = new InMemoryCommentRepository()

    const postAuthor = agentRepo.create({ owner_id: 'u-post', display_name: 'Post Author' })
    const threadAuthor = agentRepo.create({ owner_id: 'u-thread', display_name: 'Thread Author' })

    configRepo.create({
      agent_id: postAuthor.id,
      config_json: { style: { mood: 'calm', formality: 3, verbosity: 3, habits: ['logic'] } },
      updated_by: 'u-post',
    })
    configRepo.create({
      agent_id: threadAuthor.id,
      config_json: { style: { mood: 'calm', formality: 3, verbosity: 3, habits: ['logic'] } },
      updated_by: 'u-thread',
    })

    const agentService = new AgentService({
      agentRepo,
      agentConfigRepo: configRepo,
      agentRunRepo: runRepo,
    })
    const relationService = new RelationService({
      relationRepo,
      agentRepo,
      agentService,
      postRepo,
      commentRepo,
    })

    const post = await postRepo.create({
      community_id: 'community-1',
      author_agent_id: postAuthor.id,
      title: 'Root post',
      body: 'Post body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })
    const thread = await commentRepo.create({
      post_id: post.id,
      author_agent_id: threadAuthor.id,
      body: 'Opening a thread',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    await relationService.onForumCommentEvent({
      id: 'evt-thread',
      event_type: 'THREAD_OPENED',
      plane: 'DATA',
      schema_version: 'v1',
      community_id: 'community-1',
      post_id: post.id,
      room_id: null,
      actor_type: 'agent',
      actor_id: threadAuthor.id,
      cause_event_id: null,
      correlation_id: null,
      idempotency_key: null,
      created_at: new Date(),
      payload_json: {
        comment_id: thread.id,
        post_id: post.id,
        author_agent_id: threadAuthor.id,
        comment_kind: 'THREAD',
        thread_id: thread.id,
      },
    })

    const events = await relationRepo.listPairEvents(threadAuthor.id, postAuthor.id, { limit: 10 })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      event_type: 'forum_reply',
      source_type: 'forum_thread',
      source_ref_id: thread.id,
      payload: expect.objectContaining({
        post_id: post.id,
        thread_id: thread.id,
      }),
    })
  })

  it('maps turn creation to forum_turn for thread owner and anchor owner', async () => {
    const agentRepo = new InMemoryAgentRepository()
    const configRepo = new InMemoryAgentConfigRepository()
    const runRepo = new InMemoryAgentRunRepository()
    const relationRepo = new InMemoryRelationRepository()
    const postRepo = new InMemoryPostRepository()
    const commentRepo = new InMemoryCommentRepository()

    const postAuthor = agentRepo.create({ owner_id: 'u-post', display_name: 'Post Author' })
    const threadAuthor = agentRepo.create({ owner_id: 'u-thread', display_name: 'Thread Author' })
    const anchorAuthor = agentRepo.create({ owner_id: 'u-anchor', display_name: 'Anchor Author' })
    const turnAuthor = agentRepo.create({ owner_id: 'u-turn', display_name: 'Turn Author' })

    for (const agent of [postAuthor, threadAuthor, anchorAuthor, turnAuthor]) {
      configRepo.create({
        agent_id: agent.id,
        config_json: { style: { mood: 'calm', formality: 3, verbosity: 3, habits: ['logic'] } },
        updated_by: agent.owner_id,
      })
    }

    const agentService = new AgentService({
      agentRepo,
      agentConfigRepo: configRepo,
      agentRunRepo: runRepo,
    })
    const relationService = new RelationService({
      relationRepo,
      agentRepo,
      agentService,
      postRepo,
      commentRepo,
    })

    const post = await postRepo.create({
      community_id: 'community-1',
      author_agent_id: postAuthor.id,
      title: 'Root post',
      body: 'Post body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })
    const thread = await commentRepo.create({
      post_id: post.id,
      author_agent_id: threadAuthor.id,
      body: 'Opening a thread',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })
    const anchorTurn = await commentRepo.create({
      post_id: post.id,
      parent_comment_id: thread.id,
      author_agent_id: anchorAuthor.id,
      body: 'Anchor turn',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })
    const replyTurn = await commentRepo.create({
      post_id: post.id,
      parent_comment_id: anchorTurn.id,
      author_agent_id: turnAuthor.id,
      body: 'Reply turn',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    await relationService.onForumCommentEvent({
      id: 'evt-turn',
      event_type: 'THREAD_TURN_ADDED',
      plane: 'DATA',
      schema_version: 'v1',
      community_id: 'community-1',
      post_id: post.id,
      room_id: null,
      actor_type: 'agent',
      actor_id: turnAuthor.id,
      cause_event_id: null,
      correlation_id: null,
      idempotency_key: null,
      created_at: new Date(),
      payload_json: {
        comment_id: replyTurn.id,
        post_id: post.id,
        author_agent_id: turnAuthor.id,
        comment_kind: 'TURN',
        thread_id: thread.id,
      },
    })

    const threadEvents = await relationRepo.listPairEvents(turnAuthor.id, threadAuthor.id, { limit: 10 })
    expect(threadEvents).toHaveLength(1)
    expect(threadEvents[0]).toMatchObject({
      event_type: 'forum_reply',
      source_type: 'forum_turn',
      source_ref_id: replyTurn.id,
      payload: expect.objectContaining({
        post_id: post.id,
        thread_id: thread.id,
        turn_id: replyTurn.id,
      }),
    })

    const anchorEvents = await relationRepo.listPairEvents(turnAuthor.id, anchorAuthor.id, { limit: 10 })
    expect(anchorEvents).toHaveLength(1)
    expect(anchorEvents[0]).toMatchObject({
      event_type: 'reciprocal_reply',
      source_type: 'forum_turn',
      source_ref_id: replyTurn.id,
      payload: expect.objectContaining({
        thread_id: thread.id,
        turn_id: replyTurn.id,
        anchor_turn_id: anchorTurn.id,
      }),
    })
  })
})
