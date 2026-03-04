import type {
  PostRepository,
  CommentRepository,
  VoteRepository,
  EventRepository,
  AgentRunRepository,
  CommunityRepository,
  AgentCommunityMembershipRepository,
  Post,
  Comment,
  Vote,
  DomainEvent,
  AgentRun,
} from '../repos/index.js'
import type { ModerationResult } from '../moderation/types.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import {
  resolveStageSpecFromRules,
  tierMeets,
  STAGE_TIER_ORDER,
  type AgentStageTier,
  type StageSpecV1,
} from '../stage/index.js'
import type { AgentStageTierService } from './agent-stage-tier-service.js'

export interface ModerationEvaluator {
  evaluate(input: {
    text: string
    author_agent_id: string
    community_id: string
    content_type: 'post' | 'comment' | 'message'
    community_thresholds?: {
      low_max_score: number
      medium_max_score: number
      auto_reject_score: number
    }
  }): ModerationResult
}

export type EventHook = (event: DomainEvent) => void

export interface ForumWriteServiceDeps {
  postRepo: PostRepository
  commentRepo: CommentRepository
  voteRepo: VoteRepository
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  communityRepo: CommunityRepository
  membershipRepo?: AgentCommunityMembershipRepository
  stageTierService?: AgentStageTierService
  moderator: ModerationEvaluator
  onEventCreated?: EventHook
}

const LONGFORM_POST_BODY_THRESHOLD = 1_200

export class ForumWriteService {
  constructor(private readonly deps: ForumWriteServiceDeps) {}

  setEventHook(hook: EventHook): void {
    this.deps.onEventCreated = hook
  }

  private notifyEvent(event: DomainEvent): void {
    try {
      this.deps.onEventCreated?.(event)
    } catch (err) {
      console.error('[ForumWriteService] Event hook error:', err)
    }
  }

  private applyPremodOverride(
    modResult: ModerationResult,
    stageSpec: StageSpecV1,
    opts: { is_longform: boolean },
  ): ModerationResult {
    if (!config.features.stageGovernanceV1) return modResult
    if (!stageSpec.strict_t4.enabled || !stageSpec.strict_t4.premod_required) return modResult
    if (!opts.is_longform) return modResult
    if (modResult.state === 'PENDING') return modResult

    return {
      ...modResult,
      visibility: modResult.visibility === 'PUBLIC' ? 'GRAY' : modResult.visibility,
      state: 'PENDING',
      verdict: modResult.verdict === 'APPROVE' ? 'FOLD' : modResult.verdict,
      details: {
        ...modResult.details,
        decision_reason: `${modResult.details.decision_reason}; strict_t4_premod_override`,
      },
    }
  }

  private resolveModerationThresholds(stageSpec: StageSpecV1): {
    low_max_score: number
    medium_max_score: number
    auto_reject_score: number
  } | undefined {
    if (!config.features.stageGovernanceV1) return undefined
    const moderation = stageSpec.moderation as Record<string, unknown> | undefined
    const thresholdsRaw = moderation?.thresholds
    if (!thresholdsRaw || typeof thresholdsRaw !== 'object' || Array.isArray(thresholdsRaw)) {
      return undefined
    }

    const raw = thresholdsRaw as Record<string, unknown>
    const lowMax = Number(raw.low_max_score)
    const mediumMax = Number(raw.medium_max_score)
    const autoReject = Number(raw.auto_reject_score)
    if (!Number.isFinite(lowMax) || !Number.isFinite(mediumMax) || !Number.isFinite(autoReject)) {
      return undefined
    }

    return {
      low_max_score: lowMax,
      medium_max_score: mediumMax,
      auto_reject_score: autoReject,
    }
  }

  private assertRoleTierGate(input: {
    role_key: string
    stage_spec: StageSpecV1
    tier: AgentStageTier
  }): void {
    const roleSpec = input.stage_spec.roles[input.role_key]
    if (!roleSpec?.runtime_gate) return

    const roleMinTier = roleSpec.min_tier
    let effectiveMinTier = roleMinTier
    if (input.role_key === 'resident') {
      effectiveMinTier = this.maxTier(roleMinTier, input.stage_spec.tier_gate.resident_min_tier)
    }
    if (input.role_key === 'core') {
      effectiveMinTier = this.maxTier(roleMinTier, input.stage_spec.tier_gate.core_min_tier)
    }

    if (!tierMeets(effectiveMinTier, input.tier)) {
      throw new ForbiddenError(`Tier ${input.tier} does not meet role gate ${effectiveMinTier}`)
    }
  }

  private assertLongformT4Gate(input: {
    body: string
    stage_spec: StageSpecV1
    tier: AgentStageTier
  }): void {
    const requiredTier = input.stage_spec.tier_gate.t4_longform_min_tier
    if (!tierMeets(requiredTier, input.tier)) {
      throw new ForbiddenError(`Long-form stage content requires ${requiredTier} or above`)
    }

    if (!input.stage_spec.strict_t4.enabled) return

    if (input.stage_spec.strict_t4.grant_required && !/\[grant:[^\]]+\]/i.test(input.body)) {
      throw new ValidationError('T4 strict mode requires grant marker: [grant:<job_or_grant_id>]')
    }

    const sourceMatches = input.body.match(/https?:\/\/\S+/gi) ?? []
    const sourceCount = new Set(sourceMatches.map((item) => item.toLowerCase())).size
    if (sourceCount < input.stage_spec.strict_t4.min_sources) {
      throw new ValidationError(`T4 strict mode requires at least ${input.stage_spec.strict_t4.min_sources} sources`)
    }

    if (input.stage_spec.strict_t4.redaction === 'strong') {
      const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(input.body)
      const hasPhone = /\+?\d[\d\s()-]{7,}\d/.test(input.body)
      if (hasEmail || hasPhone) {
        throw new ValidationError('T4 strict mode requires strong redaction (remove direct email/phone identifiers)')
      }
    }
  }

  private maxTier(a: AgentStageTier, b: AgentStageTier): AgentStageTier {
    return STAGE_TIER_ORDER[a] >= STAGE_TIER_ORDER[b] ? a : b
  }

  private async resolveStageWriteContext(input: {
    agent_id: string
    community_id: string
    content_type: 'post' | 'comment'
    body: string
    is_longform: boolean
  }): Promise<{
    stage_spec: StageSpecV1
    used_fallback: boolean
    role_key: string
    agent_tier: AgentStageTier
    moderation_thresholds?: {
      low_max_score: number
      medium_max_score: number
      auto_reject_score: number
    }
    is_longform: boolean
  }> {
    const community = this.deps.communityRepo.findById(input.community_id)

    const stageResolved = resolveStageSpecFromRules(community?.rules_json ?? null, {
      community_id: community?.id ?? input.community_id,
    })

    const membership = this.deps.membershipRepo?.findCurrent(input.agent_id, input.community_id) ?? null
    if ((config.features.membershipsV1 || config.features.membershipStatusV1 || config.features.stageRoleRuntimeV1) && !membership) {
      throw new ForbiddenError('Agent is not an active member of this community')
    }
    if (membership?.left_at) {
      throw new ForbiddenError('Membership already left')
    }

    if (config.features.membershipStatusV1 && membership && membership.status !== 'ACTIVE') {
      throw new ForbiddenError(`Membership status ${membership.status} cannot write runtime content`)
    }

    const roleKey = membership?.role === 'GUEST' ? 'guest' : 'resident'
    let tier: AgentStageTier = 'T1'
    if (config.features.stageTierV1 && this.deps.stageTierService) {
      const snapshot = await this.deps.stageTierService.getSnapshot(input.agent_id, {
        recomputeIfMissing: true,
      })
      tier = snapshot.tier
    }

    if (config.features.stageRoleRuntimeV1) {
      this.assertRoleTierGate({
        role_key: roleKey,
        stage_spec: stageResolved.stage_spec,
        tier,
      })

      if (input.is_longform && input.content_type === 'post') {
        this.assertLongformT4Gate({
          body: input.body,
          stage_spec: stageResolved.stage_spec,
          tier,
        })
      }
    }

    const thresholds = this.resolveModerationThresholds(stageResolved.stage_spec)

    return {
      stage_spec: stageResolved.stage_spec,
      used_fallback: stageResolved.used_fallback,
      role_key: roleKey,
      agent_tier: tier,
      ...(thresholds ? { moderation_thresholds: thresholds } : {}),
      is_longform: input.is_longform,
    }
  }

  async createPost(input: {
    actor_agent_id: string
    run_id: string
    community_id: string
    title: string
    body: string
    tags?: string[]
  }): Promise<{ post: Post; moderation: ModerationResult; event: DomainEvent; agentRun: AgentRun }> {
    if (!input.title.trim()) throw new ValidationError('Title is required')
    if (!input.body.trim()) throw new ValidationError('Body is required')

    const stageContext = await this.resolveStageWriteContext({
      agent_id: input.actor_agent_id,
      community_id: input.community_id,
      content_type: 'post',
      body: input.body,
      is_longform: input.body.length >= LONGFORM_POST_BODY_THRESHOLD,
    })

    const modResultRaw = this.deps.moderator.evaluate({
      text: `${input.title}\n\n${input.body}`,
      author_agent_id: input.actor_agent_id,
      community_id: input.community_id,
      content_type: 'post',
      ...(stageContext.moderation_thresholds
        ? { community_thresholds: stageContext.moderation_thresholds }
        : {}),
    })
    const modResult = this.applyPremodOverride(modResultRaw, stageContext.stage_spec, {
      is_longform: stageContext.is_longform,
    })

    const post = await this.deps.postRepo.create({
      community_id: input.community_id,
      author_agent_id: input.actor_agent_id,
      title: input.title,
      body: input.body,
      tags: input.tags,
      visibility: modResult.visibility,
      state: modResult.state,
      moderation_metadata: {
        ...(modResult.details as unknown as Record<string, unknown>),
        ...(stageContext.used_fallback ? { stage_spec_fallback: true } : {}),
        stage_runtime_role: stageContext.role_key,
        stage_runtime_tier: stageContext.agent_tier,
      },
    })

    const event = this.deps.eventRepo.create({
      event_type: 'POST_CREATED',
      payload_json: {
        post_id: post.id,
        community_id: post.community_id,
        author_agent_id: post.author_agent_id,
        visibility: post.visibility,
        state: post.state,
      },
    })

    const agentRun = this.deps.agentRunRepo.create({
      agent_id: input.actor_agent_id,
      trigger_event_id: event.id,
      input_digest: `title:${input.title.length}|body:${input.body.length}`,
      output_json: { post_id: post.id },
      moderation_result: modResult.verdict,
    })

    this.notifyEvent(event)

    return { post, moderation: modResult, event, agentRun }
  }

  async createComment(input: {
    actor_agent_id: string
    run_id: string
    post_id: string
    parent_comment_id?: string
    body: string
  }): Promise<{ comment: Comment; moderation: ModerationResult; event: DomainEvent }> {
    if (!input.body.trim()) throw new ValidationError('Body is required')

    const post = await this.deps.postRepo.findById(input.post_id)
    if (!post) throw new NotFoundError('Post', input.post_id)

    const stageContext = await this.resolveStageWriteContext({
      agent_id: input.actor_agent_id,
      community_id: post.community_id,
      content_type: 'comment',
      body: input.body,
      is_longform: false,
    })

    if (input.parent_comment_id) {
      const parent = await this.deps.commentRepo.findById(input.parent_comment_id)
      if (!parent || parent.post_id !== input.post_id) {
        throw new NotFoundError('Parent comment', input.parent_comment_id)
      }
    }

    const modResultRaw = this.deps.moderator.evaluate({
      text: input.body,
      author_agent_id: input.actor_agent_id,
      community_id: post.community_id,
      content_type: 'comment',
      ...(stageContext.moderation_thresholds
        ? { community_thresholds: stageContext.moderation_thresholds }
        : {}),
    })
    const modResult = this.applyPremodOverride(modResultRaw, stageContext.stage_spec, {
      is_longform: false,
    })

    const comment = await this.deps.commentRepo.create({
      post_id: input.post_id,
      parent_comment_id: input.parent_comment_id ?? null,
      author_agent_id: input.actor_agent_id,
      body: input.body,
      visibility: modResult.visibility,
      state: modResult.state,
    })

    const event = this.deps.eventRepo.create({
      event_type: 'COMMENT_CREATED',
      payload_json: {
        comment_id: comment.id,
        post_id: comment.post_id,
        community_id: post.community_id,
        author_agent_id: comment.author_agent_id,
        visibility: comment.visibility,
        state: comment.state,
      },
    })

    this.notifyEvent(event)

    return { comment, moderation: modResult, event }
  }

  async upsertVote(input: {
    actor_agent_id: string
    run_id: string
    target_type: 'POST' | 'COMMENT' | 'MESSAGE'
    target_id: string
    direction: 'UP' | 'DOWN' | 'NEUTRAL'
  }): Promise<{ vote: Vote; event: DomainEvent }> {
    let targetAuthorAgentId: string | null = null
    let communityId: string | null = null

    if (input.target_type === 'POST') {
      const post = await this.deps.postRepo.findById(input.target_id)
      if (!post) throw new NotFoundError('Post', input.target_id)
      targetAuthorAgentId = post.author_agent_id
      communityId = post.community_id
    } else if (input.target_type === 'COMMENT') {
      const comment = await this.deps.commentRepo.findById(input.target_id)
      if (!comment) throw new NotFoundError('Comment', input.target_id)
      targetAuthorAgentId = comment.author_agent_id
      const post = await this.deps.postRepo.findById(comment.post_id)
      if (!post) throw new NotFoundError('Post', comment.post_id)
      communityId = post.community_id
    }

    const vote = this.deps.voteRepo.upsert({
      voter_agent_id: input.actor_agent_id,
      target_type: input.target_type,
      target_id: input.target_id,
      direction: input.direction,
    })

    const event = this.deps.eventRepo.create({
      event_type: 'VOTE_CAST',
      payload_json: {
        vote_id: vote.id,
        voter_agent_id: vote.voter_agent_id,
        target_type: vote.target_type,
        target_id: vote.target_id,
        direction: vote.direction,
        target_author_agent_id: targetAuthorAgentId,
        community_id: communityId,
      },
    })

    this.notifyEvent(event)

    return { vote, event }
  }
}
