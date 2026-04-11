import { describe, it, expect } from 'vitest'
import { AftershowService } from '../aftershow-service.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryHumanVoteRepository } from '../../repos/human-vote-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryAftershowRunRepository } from '../../repos/aftershow-run-repository.js'
import { InMemoryAudienceRepository } from '../../repos/audience-repository.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryAftershowArtifactRepository } from '../../repos/aftershow-artifact-repository.js'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import type {
  AftershowArtifactRepository,
  EventRepository,
  NotificationRepository,
} from '../../repos/index.js'
import type {
  CreateEventInput,
  DomainEvent,
  CreateNotificationInput,
  Notification,
  PaginationOpts,
  PaginatedResult,
} from '../../repos/types.js'
import { config } from '../../lib/config.js'

function buildStageSpec(
  aftershowMode = 'THRESHOLD',
  thresholdOverrides?: Partial<{ audience_comments: number; human_vote_score: number }>,
) {
  const threshold = {
    audience_comments: thresholdOverrides?.audience_comments ?? 3,
    human_vote_score: thresholdOverrides?.human_vote_score ?? 2,
  }

  return {
    version: 'v1',
    min_tier_pool: 'T1',
    roles: {
      resident: { min_tier: 'T1', runtime_gate: true },
    },
    tier_gate: {
      resident_min_tier: 'T1',
      core_min_tier: 'T1',
      strict_publication_longform_min_tier: 'T4',
    },
    strict_publication: {
      enabled: false,
      premod_required: true,
      min_sources: 3,
      grant_required: true,
      max_ttl_hours: 168,
      redaction: 'strong',
    },
    aftershow: {
      mode: aftershowMode,
      threshold,
      periodic: {
        enabled: false,
        interval_hours: 24,
      },
    },
  }
}

async function createTestAgent(agentRepo: InMemoryAgentRepository): Promise<string> {
  const agent = await agentRepo.create({
    owner_id: 'owner-a1',
    display_name: 'agent 1',
  })
  return agent.id
}

function createService(input: {
  postRepo: InMemoryPostRepository
  humanVoteRepo: InMemoryHumanVoteRepository
  audienceRepo: InMemoryAudienceRepository
  agentRepo: InMemoryAgentRepository
  communityRepo: InMemoryCommunityRepository
  runRepo: InMemoryAftershowRunRepository
  artifactRepo?: AftershowArtifactRepository
  eventRepo?: EventRepository
  notificationRepo?: NotificationRepository | null
}) {
  return new AftershowService({
    postRepo: input.postRepo,
    humanVoteRepo: input.humanVoteRepo,
    audienceRepo: input.audienceRepo,
    agentRepo: input.agentRepo,
    communityRepo: input.communityRepo,
    runRepo: input.runRepo,
    artifactRepo: input.artifactRepo ?? new InMemoryAftershowArtifactRepository(),
    eventRepo: input.eventRepo ?? new InMemoryEventRepository(),
    notificationRepo: input.notificationRepo ?? null,
  })
}

class TrackingEventRepository extends InMemoryEventRepository {
  readonly events: DomainEvent[] = []

  override create(input: CreateEventInput): DomainEvent {
    const event = super.create(input)
    this.events.push(event)
    return event
  }
}

class StubNotificationRepository implements NotificationRepository {
  readonly created: Notification[] = []

  async create(input: CreateNotificationInput): Promise<Notification> {
    const item: Notification = {
      id: `notif_${this.created.length + 1}`,
      user_id: input.user_id,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      target_type: input.target_type ?? null,
      target_id: input.target_id ?? null,
      read: false,
      created_at: new Date(),
    }
    this.created.push(item)
    return item
  }

  async list(
    _userId: string,
    _opts: PaginationOpts & { read?: boolean },
  ): Promise<PaginatedResult<Notification> & { unread_count: number }> {
    return {
      items: [...this.created],
      next_cursor: null,
      unread_count: this.created.length,
    }
  }

  async markRead(id: string, userId: string): Promise<Notification | null> {
    const item = this.created.find((entry) => entry.id === id && entry.user_id === userId)
    if (!item) return null
    item.read = true
    return item
  }

  async markAllRead(userId: string): Promise<number> {
    let count = 0
    for (const item of this.created) {
      if (item.user_id !== userId || item.read) continue
      item.read = true
      count += 1
    }
    return count
  }
}

describe('AftershowService', () => {
  it('skips threshold mode when conditions are not met', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const agentId = await createTestAgent(agentRepo)

    const community = communityRepo.create({
      name: 'Threshold Community',
      slug: `threshold-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('THRESHOLD') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: agentId,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    const result = await service.trigger({
      post_id: post.id,
      mode: 'AUTO',
      force: false,
      triggered_by_user_id: 'u1',
    })

    expect(result.run.status).toBe('SKIPPED')
    expect(result.reason).toBe('threshold_not_met')
  })

  it('creates run when threshold is met', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const agentId = await createTestAgent(agentRepo)

    const community = communityRepo.create({
      name: 'Threshold Community 2',
      slug: `threshold-2-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('THRESHOLD') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: agentId,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const thread = await audienceRepo.upsertThreadByPost({
      post_id: post.id,
      community_id: post.community_id,
      status: 'OPEN',
    })

    await audienceRepo.createMessage({
      thread_id: thread.id,
      author_user_id: 'u1',
      body: '1',
    })
    await audienceRepo.createMessage({
      thread_id: thread.id,
      author_user_id: 'u2',
      body: '2',
    })
    await audienceRepo.createMessage({
      thread_id: thread.id,
      author_user_id: 'u3',
      body: '3',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    const result = await service.trigger({
      post_id: post.id,
      mode: 'AUTO',
      force: false,
      triggered_by_user_id: 'u1',
    })

    expect(result.run.status).toBe('CREATED')
    expect(result.threshold_pass).toBe(true)
  })

  it('supports PERIODIC mode but defaults to skip when periodic disabled', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const agentId = await createTestAgent(agentRepo)

    const community = communityRepo.create({
      name: 'Periodic Community',
      slug: `periodic-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('PERIODIC') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: agentId,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    const result = await service.trigger({
      post_id: post.id,
      mode: 'AUTO',
      force: false,
      triggered_by_user_id: 'u1',
    })

    expect(result.run.mode).toBe('PERIODIC')
    expect(result.run.status).toBe('SKIPPED')
    expect(result.reason).toBe('periodic_disabled')
  })

  it('skips when aftershow mode is OFF', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const agentId = await createTestAgent(agentRepo)

    const community = communityRepo.create({
      name: 'Off Community',
      slug: `off-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('OFF') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: agentId,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    const result = await service.trigger({
      post_id: post.id,
      mode: 'AUTO',
      force: false,
    })

    expect(result.run.status).toBe('SKIPPED')
    expect(result.reason).toBe('aftershow_mode_off')
  })

  it('force bypasses OFF mode and creates run', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const agentId = await createTestAgent(agentRepo)

    const community = communityRepo.create({
      name: 'Force Community',
      slug: `force-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('OFF') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: agentId,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    const result = await service.trigger({
      post_id: post.id,
      mode: 'MANUAL',
      force: true,
    })

    expect(result.run.status).toBe('CREATED')
    expect(result.reason).toBe('triggered')
  })

  it('blocks manual trigger for non-owner non-admin actor', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const ownerAgent = await agentRepo.create({
      owner_id: 'owner-a1',
      display_name: 'agent 1',
    })

    const community = communityRepo.create({
      name: 'Permission Community',
      slug: `permission-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('THRESHOLD') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: ownerAgent.id,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    await expect(
      service.trigger({
        post_id: post.id,
        mode: 'MANUAL',
        force: true,
        triggered_by_user_id: 'not-owner',
        actor_role: 'user',
      }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('throws NotFoundError for non-existent post', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    await expect(
      service.trigger({ post_id: 'non-existent', mode: 'AUTO', force: false }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('creates run when human vote score meets threshold', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const agentId = await createTestAgent(agentRepo)

    const community = communityRepo.create({
      name: 'Vote Community',
      slug: `vote-${Date.now()}`,
      rules_json: { stage_spec_v1: buildStageSpec('THRESHOLD') },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: agentId,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    await humanVoteRepo.upsert({
      voter_user_id: 'u1',
      target_type: 'POST',
      target_id: post.id,
      direction: 'UP',
    })
    await humanVoteRepo.upsert({
      voter_user_id: 'u2',
      target_type: 'POST',
      target_id: post.id,
      direction: 'UP',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    const result = await service.trigger({
      post_id: post.id,
      mode: 'AUTO',
      force: false,
    })

    expect(result.run.status).toBe('CREATED')
    expect(result.threshold_pass).toBe(true)
  })

  it('treats threshold value 0 as disabled and only evaluates enabled threshold items', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const agentId = await createTestAgent(agentRepo)

    const community = communityRepo.create({
      name: 'Zero Threshold Community',
      slug: `zero-threshold-${Date.now()}`,
      rules_json: {
        stage_spec_v1: buildStageSpec('THRESHOLD', {
          audience_comments: 1,
          human_vote_score: 0,
        }),
      },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: agentId,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const thread = await audienceRepo.upsertThreadByPost({
      post_id: post.id,
      community_id: post.community_id,
      status: 'OPEN',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    const beforeAudienceMessage = await service.trigger({
      post_id: post.id,
      mode: 'AUTO',
      force: false,
    })

    expect(beforeAudienceMessage.run.status).toBe('SKIPPED')
    expect(beforeAudienceMessage.reason).toBe('threshold_not_met')
    expect(beforeAudienceMessage.threshold_pass).toBe(false)

    await audienceRepo.createMessage({
      thread_id: thread.id,
      author_user_id: 'u1',
      body: 'first audience message',
    })

    const afterAudienceMessage = await service.trigger({
      post_id: post.id,
      mode: 'AUTO',
      force: false,
    })

    expect(afterAudienceMessage.run.status).toBe('CREATED')
    expect(afterAudienceMessage.reason).toBe('triggered')
    expect(afterAudienceMessage.threshold_pass).toBe(true)
  })

  it('records stage_spec_errors in explicit fields when rules_json is invalid', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()

    const agentId = await createTestAgent(agentRepo)

    const community = communityRepo.create({
      name: 'Invalid Community',
      slug: `invalid-${Date.now()}`,
      rules_json: { stage_spec_v1: { version: 'v1', min_tier_pool: 'INVALID_TIER' } },
    })

    const post = await postRepo.create({
      community_id: community.id,
      author_agent_id: agentId,
      title: 'title',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
    })

    const result = await service.trigger({
      post_id: post.id,
      mode: 'AUTO',
      force: false,
    })

    expect(result.run.used_stage_fallback).toBe(true)
    expect(Array.isArray(result.run.stage_spec_errors)).toBe(true)
    expect(result.run.stage_spec_errors.length).toBeGreaterThan(0)
  })

  it('getLatestByPost keeps latest published artifact when newest run is aborted', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalPipelineFlag = featureFlags.aftershowEventPipelineV1
    featureFlags.aftershowEventPipelineV1 = true

    try {
      const postRepo = new InMemoryPostRepository()
      const humanVoteRepo = new InMemoryHumanVoteRepository()
      const communityRepo = new InMemoryCommunityRepository()
      const runRepo = new InMemoryAftershowRunRepository()
      const audienceRepo = new InMemoryAudienceRepository()
      const agentRepo = new InMemoryAgentRepository()
      const artifactRepo = new InMemoryAftershowArtifactRepository()

      const agentId = await createTestAgent(agentRepo)
      const community = communityRepo.create({
        name: 'Published fallback community',
        slug: `published-fallback-${Date.now()}`,
        rules_json: { stage_spec_v1: buildStageSpec('THRESHOLD') },
      })
      const post = await postRepo.create({
        community_id: community.id,
        author_agent_id: agentId,
        title: 'title',
        body: 'body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const thread = await audienceRepo.upsertThreadByPost({
        post_id: post.id,
        community_id: post.community_id,
        status: 'OPEN',
      })
      await audienceRepo.createMessage({
        thread_id: thread.id,
        author_user_id: 'u1',
        body: 'msg 1',
      })

      const service = createService({
        postRepo,
        humanVoteRepo,
        audienceRepo,
        agentRepo,
        communityRepo,
        runRepo,
        artifactRepo,
      })

      const first = await service.trigger({
        post_id: post.id,
        mode: 'MANUAL',
        force: true,
      })
      expect(first.artifact?.status).toBe('PUBLISHED')

      const second = await service.trigger({
        post_id: post.id,
        mode: 'MANUAL',
        force: true,
      })
      expect(second.artifact?.status).toBe('ABORTED')
      expect(second.reason).toBe('publish_rate_limited')

      const latest = await service.getLatestByPost(post.id)
      expect(latest.artifact).toBeTruthy()
      expect(latest.artifact?.status).toBe('PUBLISHED')
      expect(latest.artifact?.id).toBe(first.artifact?.id)
      expect(latest.callouts.length).toBeGreaterThan(0)
    } finally {
      featureFlags.aftershowEventPipelineV1 = originalPipelineFlag
    }
  })

  it('getLatestByPost returns empty when no published artifact exists', async () => {
    const postRepo = new InMemoryPostRepository()
    const humanVoteRepo = new InMemoryHumanVoteRepository()
    const communityRepo = new InMemoryCommunityRepository()
    const runRepo = new InMemoryAftershowRunRepository()
    const audienceRepo = new InMemoryAudienceRepository()
    const agentRepo = new InMemoryAgentRepository()
    const artifactRepo = new InMemoryAftershowArtifactRepository()

    const now = new Date()
    await artifactRepo.createArtifact({
      run_id: 'run-aborted-only',
      post_id: 'post-aborted-only',
      community_id: 'comm-aborted-only',
      status: 'ABORTED',
      window_start: now,
      window_end: now,
      summary_text: 'aborted artifact',
      reason: 'publish_rate_limited',
    })

    const service = createService({
      postRepo,
      humanVoteRepo,
      audienceRepo,
      agentRepo,
      communityRepo,
      runRepo,
      artifactRepo,
    })

    const latest = await service.getLatestByPost('post-aborted-only')
    expect(latest.artifact).toBeNull()
    expect(latest.callouts).toEqual([])
  })

  it('emits extended aftershow pipeline events in order', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalPipelineFlag = featureFlags.aftershowEventPipelineV1
    featureFlags.aftershowEventPipelineV1 = true

    try {
      const postRepo = new InMemoryPostRepository()
      const humanVoteRepo = new InMemoryHumanVoteRepository()
      const communityRepo = new InMemoryCommunityRepository()
      const runRepo = new InMemoryAftershowRunRepository()
      const audienceRepo = new InMemoryAudienceRepository()
      const agentRepo = new InMemoryAgentRepository()
      const eventRepo = new TrackingEventRepository()

      const agentId = await createTestAgent(agentRepo)
      const community = communityRepo.create({
        name: 'Event sequence community',
        slug: `event-sequence-${Date.now()}`,
        rules_json: { stage_spec_v1: buildStageSpec('THRESHOLD') },
      })
      const post = await postRepo.create({
        community_id: community.id,
        author_agent_id: agentId,
        title: 'title',
        body: 'body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const thread = await audienceRepo.upsertThreadByPost({
        post_id: post.id,
        community_id: post.community_id,
        status: 'OPEN',
      })
      await audienceRepo.createMessage({
        thread_id: thread.id,
        author_user_id: 'u1',
        body: 'msg 1',
      })

      const service = createService({
        postRepo,
        humanVoteRepo,
        audienceRepo,
        agentRepo,
        communityRepo,
        runRepo,
        eventRepo,
      })

      const result = await service.trigger({
        post_id: post.id,
        mode: 'MANUAL',
        force: true,
      })
      expect(result.artifact?.status).toBe('PUBLISHED')
      expect(result.callouts.length).toBeGreaterThan(0)

      const eventTypes = eventRepo.events.map((event) => event.event_type)
      const idx = (eventType: string) => eventTypes.indexOf(eventType)

      expect(idx('AFTERSHOW_DUE')).toBeGreaterThanOrEqual(0)
      expect(idx('AFTERSHOW_SNAPSHOT_CREATED')).toBeGreaterThanOrEqual(0)
      expect(idx('AFTERSHOW_INPUT_SNAPSHOT_CREATED')).toBeGreaterThanOrEqual(0)
      expect(idx('AFTERSHOW_COMPOSE_REQUESTED')).toBeGreaterThanOrEqual(0)
      expect(idx('AFTERSHOW_COMPOSED')).toBeGreaterThanOrEqual(0)
      expect(idx('AFTERSHOW_PUBLISHED')).toBeGreaterThanOrEqual(0)
      expect(idx('AFTERSHOW_ENTRY_CREATED')).toBeGreaterThanOrEqual(0)
      expect(idx('AFTERSHOW_CALLOUTS_EXTRACTED')).toBeGreaterThanOrEqual(0)

      expect(idx('AFTERSHOW_DUE')).toBeLessThan(idx('AFTERSHOW_SNAPSHOT_CREATED'))
      expect(idx('AFTERSHOW_SNAPSHOT_CREATED')).toBeLessThan(idx('AFTERSHOW_INPUT_SNAPSHOT_CREATED'))
      expect(idx('AFTERSHOW_INPUT_SNAPSHOT_CREATED')).toBeLessThan(idx('AFTERSHOW_COMPOSE_REQUESTED'))
      expect(idx('AFTERSHOW_COMPOSE_REQUESTED')).toBeLessThan(idx('AFTERSHOW_COMPOSED'))
      expect(idx('AFTERSHOW_COMPOSED')).toBeLessThan(idx('AFTERSHOW_PUBLISHED'))
      expect(idx('AFTERSHOW_PUBLISHED')).toBeLessThan(idx('AFTERSHOW_ENTRY_CREATED'))
      expect(idx('AFTERSHOW_ENTRY_CREATED')).toBeLessThan(idx('AFTERSHOW_CALLOUTS_EXTRACTED'))
    } finally {
      featureFlags.aftershowEventPipelineV1 = originalPipelineFlag
    }
  })

  it('enforces max unique users per aftershow while allowing previously-unnotified users on next run', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalPipelineFlag = featureFlags.aftershowEventPipelineV1
    featureFlags.aftershowEventPipelineV1 = true

    try {
      const postRepo = new InMemoryPostRepository()
      const humanVoteRepo = new InMemoryHumanVoteRepository()
      const communityRepo = new InMemoryCommunityRepository()
      const runRepo = new InMemoryAftershowRunRepository()
      const audienceRepo = new InMemoryAudienceRepository()
      const agentRepo = new InMemoryAgentRepository()
      const artifactRepo = new InMemoryAftershowArtifactRepository()
      const notificationRepo = new StubNotificationRepository()

      const agentId = await createTestAgent(agentRepo)
      const community = communityRepo.create({
        name: 'Notification policy community',
        slug: `notification-policy-${Date.now()}`,
        rules_json: { stage_spec_v1: buildStageSpec('THRESHOLD') },
      })
      const post = await postRepo.create({
        community_id: community.id,
        author_agent_id: agentId,
        title: 'title',
        body: 'body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })
      const thread = await audienceRepo.upsertThreadByPost({
        post_id: post.id,
        community_id: post.community_id,
        status: 'OPEN',
      })

      for (let i = 1; i <= 10; i += 1) {
        await audienceRepo.createMessage({
          thread_id: thread.id,
          author_user_id: `user-${i}`,
          body: `msg ${i}`,
        })
      }

      const service = createService({
        postRepo,
        humanVoteRepo,
        audienceRepo,
        agentRepo,
        communityRepo,
        runRepo,
        artifactRepo,
        notificationRepo,
      })

      const first = await service.trigger({
        post_id: post.id,
        mode: 'MANUAL',
        force: true,
      })
      expect(first.artifact?.status).toBe('PUBLISHED')
      expect(first.callouts.length).toBe(10)
      expect(first.notifications_created).toBe(8)
      expect(notificationRepo.created.length).toBe(8)
      const firstBatchNotifiedUsers = new Set(notificationRepo.created.map((item) => item.user_id))

      const artifacts = (artifactRepo as unknown as {
        artifacts: Map<string, { created_at: Date }>
      }).artifacts
      for (const artifact of artifacts.values()) {
        artifact.created_at = new Date(Date.now() - 2 * 60 * 60 * 1000)
      }

      const second = await service.trigger({
        post_id: post.id,
        mode: 'MANUAL',
        force: true,
      })
      expect(second.artifact?.status).toBe('PUBLISHED')
      expect(second.notifications_created).toBe(2)
      expect(notificationRepo.created.length).toBe(10)

      const secondBatch = notificationRepo.created.slice(8)
      expect(secondBatch).toHaveLength(2)
      for (const item of secondBatch) {
        expect(firstBatchNotifiedUsers.has(item.user_id)).toBe(false)
      }
    } finally {
      featureFlags.aftershowEventPipelineV1 = originalPipelineFlag
    }
  })

  it('bridges audience via summary ref without exposing raw messages in run meta', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalSummaryFlag = featureFlags.aftershowAudienceSummaryV1
    featureFlags.aftershowAudienceSummaryV1 = true

    try {
      const postRepo = new InMemoryPostRepository()
      const humanVoteRepo = new InMemoryHumanVoteRepository()
      const communityRepo = new InMemoryCommunityRepository()
      const runRepo = new InMemoryAftershowRunRepository()
      const audienceRepo = new InMemoryAudienceRepository()
      const agentRepo = new InMemoryAgentRepository()

      const ownerAgent = await agentRepo.create({
        owner_id: 'owner-a1',
        display_name: 'agent 1',
      })

      const community = communityRepo.create({
        name: 'Summary Community',
        slug: `summary-${Date.now()}`,
        rules_json: {
          stage_spec_v1: {
            ...buildStageSpec('THRESHOLD'),
            human_participation: {
              public_participation_mode: 'audience_sidecar',
              audience_signal_ingestion: 'summary_only',
              agent_human_response_mode: 'aftershow_only',
            },
          },
        },
      })

      const post = await postRepo.create({
        community_id: community.id,
        author_agent_id: ownerAgent.id,
        title: 'title',
        body: 'body',
        visibility: 'PUBLIC',
        state: 'APPROVED',
      })

      const thread = await audienceRepo.upsertThreadByPost({
        post_id: post.id,
        community_id: post.community_id,
        status: 'OPEN',
      })
      await audienceRepo.createMessage({
        thread_id: thread.id,
        author_user_id: 'u1',
        body: 'This raw message should not be copied to run meta',
      })

      const service = createService({
        postRepo,
        humanVoteRepo,
        audienceRepo,
        agentRepo,
        communityRepo,
        runRepo,
      })

      const result = await service.trigger({
        post_id: post.id,
        mode: 'AUTO',
        force: false,
      })

      expect(result.summary_ref).toBeTruthy()
      const latestSummary = await audienceRepo.findLatestSummaryByThread(thread.id)
      expect(latestSummary?.id).toBe(result.summary_ref)

      expect(result.run.audience_summary_ref).toBe(result.summary_ref)
      expect(JSON.stringify(result.run)).not.toContain('This raw message should not be copied to run meta')
    } finally {
      featureFlags.aftershowAudienceSummaryV1 = originalSummaryFlag
    }
  })
})
