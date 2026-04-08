import { beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '../../lib/config.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryRiskGovernanceRepository } from '../../repos/risk-governance-repository.js'
import type { ModerationResult } from '../../moderation/types.js'
import { ParticipationContractService } from '../participation-contract-service.js'
import { PublicWriteGovernanceService } from '../public-write-governance-service.js'
import type { PublicWriteCommunityRole } from '../../../shared/forum-orchestration.js'

function setup(options?: {
  public_participation_mode?: 'llm_only' | 'audience_sidecar' | 'open_reply'
  audience_signal_ingestion?: 'none' | 'summary_only' | 'direct_read'
  agent_human_response_mode?: 'none' | 'aftershow_only' | 'direct_reply'
}) {
  const communityRepo = new InMemoryCommunityRepository()
  const postRepo = new InMemoryPostRepository()
  const agentRepo = new InMemoryAgentRepository()
  const eventRepo = new InMemoryEventRepository()
  const riskRepo = new InMemoryRiskGovernanceRepository()
  const moderator = {
    evaluate: vi.fn<(_input: unknown) => ModerationResult>(),
  }
  const participationContractService = new ParticipationContractService({
    communityRepo,
    postRepo,
    agentRepo,
  })
  const service = new PublicWriteGovernanceService({
    postRepo,
    agentRepo,
    participationContractService,
    moderator,
    riskRepo,
    eventRepo,
  })

  const ownerAgent = agentRepo.create({
    owner_id: 'owner-1',
    display_name: 'Owner Agent',
  })
  const community = communityRepo.create({
    name: 'Community',
    slug: `community-${Date.now()}`,
    rules_json: {
      stage_spec_v1: {
        human_participation: {
          public_participation_mode: options?.public_participation_mode ?? 'open_reply',
          audience_signal_ingestion: options?.audience_signal_ingestion ?? 'direct_read',
          agent_human_response_mode: options?.agent_human_response_mode ?? 'direct_reply',
        },
      },
    },
  })

  return {
    communityRepo,
    postRepo,
    agentRepo,
    eventRepo,
    riskRepo,
    moderator,
    participationContractService,
    service,
    ownerAgent,
    community,
  }
}

function buildWriteAuthContext(overrides?: {
  community_role?: PublicWriteCommunityRole
  session_id?: string | null
  user_agent_hash?: string | null
}) {
  return {
    community_role: overrides?.community_role ?? 'VIEWER',
    session_id: overrides?.session_id ?? 'session-hash',
    user_agent_hash: overrides?.user_agent_hash ?? 'ua-hash',
  }
}

describe('PublicWriteGovernanceService', () => {
  const featureFlags = config.features as unknown as Record<string, boolean>
  let originalFlags: Record<string, boolean>

  beforeEach(() => {
    originalFlags = {
      humanParticipationV1: featureFlags.humanParticipationV1,
      audienceZoneV1: featureFlags.audienceZoneV1,
      riskControlV1: featureFlags.riskControlV1,
      riskControlPublicEnforce: featureFlags.riskControlPublicEnforce,
    }
    featureFlags.humanParticipationV1 = true
    featureFlags.audienceZoneV1 = true
    featureFlags.riskControlV1 = false
    featureFlags.riskControlPublicEnforce = false
  })

  function restoreFlags() {
    featureFlags.humanParticipationV1 = originalFlags.humanParticipationV1
    featureFlags.audienceZoneV1 = originalFlags.audienceZoneV1
    featureFlags.riskControlV1 = originalFlags.riskControlV1
    featureFlags.riskControlPublicEnforce = originalFlags.riskControlPublicEnforce
  }

  it('accepts stage writes allowed by the effective contract and records audit context', async () => {
    const ctx = setup()
    const post = await ctx.postRepo.create({
      community_id: ctx.community.id,
      author_agent_id: ctx.ownerAgent.id,
      title: 'Target',
      body: 'Body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const result = await ctx.service.handleWrite({
      action: 'CREATE_PUBLIC_THREAD',
      actor_user_id: 'viewer-1',
      actor_role: 'user',
      ...buildWriteAuthContext(),
      client_ip: '1.2.3.4',
      post_id: post.id,
      body: 'Hello from a viewer',
      idempotency_key: 'thread-key-1',
      source_context: {
        discovered_via: 'discussion_forest',
        source_surface: 'post_detail',
        source_shelf: 'forest',
      },
      executeAcceptedWrite: async () => ({
        thread_id: 'thread-1',
        turn_id: null,
        audience_message_id: null,
      }),
    })

    expect(result).toMatchObject({
      action: 'CREATE_PUBLIC_THREAD',
      result: 'ACCEPTED',
      thread_id: 'thread-1',
      turn_id: null,
      audience_message_id: null,
    })

    const events = await ctx.riskRepo.listRiskEvents({ limit: 10, user_id: 'viewer-1' })
    expect(events.items).toHaveLength(1)
    expect(events.items[0].payload).toMatchObject({
      audit_record: {
        audit_id: result.audit_id,
        actor_user_id: 'viewer-1',
        actor_role: 'VIEWER',
        resource_ref: {
          kind: 'THREAD',
          id: 'thread-1',
        },
        auth_context: {
          community_role: 'VIEWER',
          session_id: 'session-hash',
          ip_hash: expect.any(String),
          user_agent_hash: 'ua-hash',
        },
        feature_flag_snapshot: {
          humanParticipationV1: true,
          audienceZoneV1: true,
          riskControlV1: false,
          riskControlPublicEnforce: false,
        },
      },
    })
    expect(events.items[0].payload?.audit_record).toMatchObject({
      audit_id: result.audit_id,
    })
    expect((events.items[0].payload?.audit_record as { audit_id?: string } | undefined)?.audit_id).not.toBe('')

    restoreFlags()
  })

  it('accepts audience writes when the lane posting policy is enabled', async () => {
    const ctx = setup({
      public_participation_mode: 'audience_sidecar',
      audience_signal_ingestion: 'direct_read',
      agent_human_response_mode: 'aftershow_only',
    })
    const post = await ctx.postRepo.create({
      community_id: ctx.community.id,
      author_agent_id: ctx.ownerAgent.id,
      title: 'Target',
      body: 'Body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const result = await ctx.service.handleWrite({
      action: 'CREATE_AUDIENCE_MESSAGE',
      actor_user_id: 'viewer-2',
      actor_role: 'user',
      ...buildWriteAuthContext(),
      client_ip: '2.2.2.2',
      post_id: post.id,
      body: 'Audience message',
      executeAcceptedWrite: async () => ({
        thread_id: 'aud-thread-1',
        turn_id: null,
        audience_message_id: 'aud-msg-1',
      }),
    })

    expect(result).toMatchObject({
      action: 'CREATE_AUDIENCE_MESSAGE',
      result: 'ACCEPTED',
      thread_id: 'aud-thread-1',
      audience_message_id: 'aud-msg-1',
    })

    restoreFlags()
  })

  it('blocks stage writes when the effective contract closes public stage entry', async () => {
    const ctx = setup({
      public_participation_mode: 'llm_only',
      audience_signal_ingestion: 'none',
      agent_human_response_mode: 'none',
    })
    const post = await ctx.postRepo.create({
      community_id: ctx.community.id,
      author_agent_id: ctx.ownerAgent.id,
      title: 'Target',
      body: 'Body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    await expect(ctx.service.handleWrite({
      action: 'CREATE_PUBLIC_THREAD',
      actor_user_id: 'viewer-3',
      actor_role: 'user',
      ...buildWriteAuthContext(),
      client_ip: '3.3.3.3',
      post_id: post.id,
      body: 'Blocked',
      executeAcceptedWrite: async () => ({
        thread_id: 'thread-2',
        turn_id: null,
        audience_message_id: null,
      }),
    })).rejects.toThrow('Post does not allow viewer thread entry on the main stage')

    restoreFlags()
  })

  it('blocks audience writes when the audience lane is visible but posting stays disabled', async () => {
    const ctx = setup({
      public_participation_mode: 'open_reply',
      audience_signal_ingestion: 'direct_read',
      agent_human_response_mode: 'direct_reply',
    })
    const post = await ctx.postRepo.create({
      community_id: ctx.community.id,
      author_agent_id: ctx.ownerAgent.id,
      title: 'Target',
      body: 'Body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    await expect(ctx.service.handleWrite({
      action: 'CREATE_AUDIENCE_MESSAGE',
      actor_user_id: 'viewer-4',
      actor_role: 'user',
      ...buildWriteAuthContext(),
      client_ip: '4.4.4.4',
      post_id: post.id,
      body: 'Blocked audience',
      executeAcceptedWrite: async () => ({
        thread_id: 'aud-thread-2',
        turn_id: null,
        audience_message_id: 'aud-msg-2',
      }),
    })).rejects.toThrow('Post does not allow viewer audience messages')

    restoreFlags()
  })

  it('replays the stored outcome for duplicate idempotency keys', async () => {
    const ctx = setup()
    const post = await ctx.postRepo.create({
      community_id: ctx.community.id,
      author_agent_id: ctx.ownerAgent.id,
      title: 'Target',
      body: 'Body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })
    const executeAcceptedWrite = vi.fn(async () => ({
      thread_id: 'thread-3',
      turn_id: null,
      audience_message_id: null,
    }))

    const first = await ctx.service.handleWrite({
      action: 'CREATE_PUBLIC_THREAD',
      actor_user_id: 'viewer-5',
      actor_role: 'user',
      ...buildWriteAuthContext(),
      client_ip: '5.5.5.5',
      post_id: post.id,
      body: 'Deduped',
      idempotency_key: 'dedupe-thread',
      executeAcceptedWrite,
    })
    const second = await ctx.service.handleWrite({
      action: 'CREATE_PUBLIC_THREAD',
      actor_user_id: 'viewer-5',
      actor_role: 'user',
      ...buildWriteAuthContext(),
      client_ip: '5.5.5.5',
      post_id: post.id,
      body: 'Deduped again',
      idempotency_key: 'dedupe-thread',
      executeAcceptedWrite,
    })

    expect(executeAcceptedWrite).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)

    restoreFlags()
  })

  it('returns RATE_LIMITED when the rate profile is exhausted', async () => {
    featureFlags.riskControlV1 = true
    featureFlags.riskControlPublicEnforce = true

    const ctx = setup()
    const post = await ctx.postRepo.create({
      community_id: ctx.community.id,
      author_agent_id: ctx.ownerAgent.id,
      title: 'Target',
      body: 'Body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    await ctx.riskRepo.createRiskEvent({
      channel: 'forum_public_write',
      event_type: 'public_write_result',
      action: 'CREATE_PUBLIC_THREAD',
      user_id: 'viewer-6',
      community_id: ctx.community.id,
      target_type: 'viewer_public_thread',
      target_id: post.id,
      payload: null,
    })
    await ctx.riskRepo.createRiskEvent({
      channel: 'forum_public_write',
      event_type: 'public_write_result',
      action: 'CREATE_PUBLIC_THREAD',
      user_id: 'viewer-6',
      community_id: ctx.community.id,
      target_type: 'viewer_public_thread',
      target_id: post.id,
      payload: null,
    })
    await ctx.riskRepo.createRiskEvent({
      channel: 'forum_public_write',
      event_type: 'public_write_result',
      action: 'CREATE_PUBLIC_THREAD',
      user_id: 'viewer-6',
      community_id: ctx.community.id,
      target_type: 'viewer_public_thread',
      target_id: post.id,
      payload: null,
    })

    const executeAcceptedWrite = vi.fn(async () => ({
      thread_id: 'thread-6',
      turn_id: null,
      audience_message_id: null,
    }))

    const result = await ctx.service.handleWrite({
      action: 'CREATE_PUBLIC_THREAD',
      actor_user_id: 'viewer-6',
      actor_role: 'user',
      ...buildWriteAuthContext(),
      client_ip: '6.6.6.6',
      post_id: post.id,
      body: 'Too fast',
      executeAcceptedWrite,
    })

    expect(result.result).toBe('RATE_LIMITED')
    expect(executeAcceptedWrite).not.toHaveBeenCalled()

    restoreFlags()
  })

  it('returns PENDING_MODERATION when risk control is enabled without public enforce', async () => {
    featureFlags.riskControlV1 = true
    featureFlags.riskControlPublicEnforce = false

    const ctx = setup()
    const post = await ctx.postRepo.create({
      community_id: ctx.community.id,
      author_agent_id: ctx.ownerAgent.id,
      title: 'Target',
      body: 'Body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })
    const executeAcceptedWrite = vi.fn(async () => ({
      thread_id: 'thread-7',
      turn_id: null,
      audience_message_id: null,
    }))

    const result = await ctx.service.handleWrite({
      action: 'CREATE_PUBLIC_THREAD',
      actor_user_id: 'viewer-7',
      actor_role: 'user',
      ...buildWriteAuthContext(),
      client_ip: '7.7.7.7',
      post_id: post.id,
      body: 'Needs moderation',
      executeAcceptedWrite,
    })

    expect(result.result).toBe('PENDING_MODERATION')
    expect(executeAcceptedWrite).not.toHaveBeenCalled()

    restoreFlags()
  })

  it('returns REJECTED when moderation rejects the write', async () => {
    featureFlags.riskControlV1 = true
    featureFlags.riskControlPublicEnforce = true

    const ctx = setup()
    ctx.moderator.evaluate.mockReturnValue({
      risk_level: 'high',
      risk_score: 1,
      risk_categories: ['spam_flooding'],
      visibility: 'QUARANTINE',
      state: 'REJECTED',
      verdict: 'REJECT',
      details: {
        rule_filter: { passed: true, matched_rules: [] },
        classifier_score: 1,
        classifier_categories: ['spam_flooding'],
        decision_reason: 'reject',
        fail_closed: false,
      },
    })
    const post = await ctx.postRepo.create({
      community_id: ctx.community.id,
      author_agent_id: ctx.ownerAgent.id,
      title: 'Target',
      body: 'Body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })
    const executeAcceptedWrite = vi.fn(async () => ({
      thread_id: 'thread-8',
      turn_id: null,
      audience_message_id: null,
    }))

    const result = await ctx.service.handleWrite({
      action: 'CREATE_PUBLIC_THREAD',
      actor_user_id: 'viewer-8',
      actor_role: 'user',
      ...buildWriteAuthContext(),
      client_ip: '8.8.8.8',
      post_id: post.id,
      body: 'Rejected content',
      executeAcceptedWrite,
    })

    expect(result.result).toBe('REJECTED')
    expect(executeAcceptedWrite).not.toHaveBeenCalled()

    restoreFlags()
  })
})
