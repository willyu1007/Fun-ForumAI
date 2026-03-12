import type {
  PostRepository,
  CommentRepository,
  VoteRepository,
  EventRepository,
  AgentRunRepository,
  CommunityRepository,
  AgentCommunityMembershipRepository,
  RoleAssignmentRepository,
  Post,
  Comment,
  Vote,
  DomainEvent,
  AgentRun,
} from '../repos/index.js'
import type { IncubationRepository } from '../repos/incubation-repository.js'
import type { ModerationResult } from '../moderation/types.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import { richCommunitiesMetrics } from '../lib/rich-communities-metrics.js'
import {
  resolveStageSpecFromRules,
  tierMeets,
  STAGE_TIER_ORDER,
  type AgentStageTier,
  type StageSpecV1,
} from '../stage/index.js'
import type { AgentStageTierService } from './agent-stage-tier-service.js'
import type { PolicyGatewayService } from './policy-gateway-service.js'

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
  roleAssignmentRepo?: RoleAssignmentRepository
  stageTierService?: AgentStageTierService
  incubationRepo?: IncubationRepository
  moderator: ModerationEvaluator
  policyGatewayService?: PolicyGatewayService
  onEventCreated?: EventHook
}

const LONGFORM_POST_BODY_THRESHOLD = 1_200
interface TrustContextInput {
  job_id: string
  grant_id: string
  source_bundle_ids: string[]
  citation_urls?: string[]
  redaction_profile?: 'strong' | 'medium' | 'light'
}

export class ForumWriteService {
  constructor(private readonly deps: ForumWriteServiceDeps) {}

  private normalizeChainDepth(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0
    return Math.max(0, Math.floor(value))
  }

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
    if (!roleSpec) {
      throw new ForbiddenError(`Role ${input.role_key} is not allowed by stage spec`)
    }
    if (!roleSpec.runtime_gate) return

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

  private rejectStrictT4(reason: string, message: string): never {
    richCommunitiesMetrics.recordStrictT4Reject(reason)
    throw new ValidationError(message)
  }

  private assertLegacyLongformTrustGate(input: {
    body: string
    stage_spec: StageSpecV1
  }): void {
    if (input.stage_spec.strict_t4.grant_required && !/\[grant:[^\]]+\]/i.test(input.body)) {
      this.rejectStrictT4('grant_marker_missing', 'T4 strict mode requires grant marker: [grant:<job_or_grant_id>]')
    }

    const sourceMatches = input.body.match(/https?:\/\/\S+/gi) ?? []
    const sourceCount = new Set(sourceMatches.map((item) => item.toLowerCase())).size
    if (sourceCount < input.stage_spec.strict_t4.min_sources) {
      this.rejectStrictT4(
        'source_count_insufficient',
        `T4 strict mode requires at least ${input.stage_spec.strict_t4.min_sources} sources`,
      )
    }
  }

  private assertLegacyStrongRedaction(body: string): void {
    const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(body)
    const hasPhone = /\+?\d[\d\s()-]{7,}\d/.test(body)
    if (hasEmail || hasPhone) {
      this.rejectStrictT4('legacy_redaction_violation', 'T4 strict mode requires strong redaction (remove direct email/phone identifiers)')
    }
  }

  private async assertLongformT4Gate(input: {
    body: string
    stage_spec: StageSpecV1
    tier: AgentStageTier
    actor_agent_id: string
    community_id: string
    trust_context?: TrustContextInput
  }): Promise<void> {
    const requiredTier = input.stage_spec.tier_gate.t4_longform_min_tier
    if (!tierMeets(requiredTier, input.tier)) {
      throw new ForbiddenError(`Long-form stage content requires ${requiredTier} or above`)
    }

    if (!input.stage_spec.strict_t4.enabled) return

    const enforceStructured = config.features.incubationTrustHardEnforce
    const trustContext = input.trust_context

    if (!this.deps.incubationRepo || !trustContext) {
      if (enforceStructured) {
        this.rejectStrictT4(
          'trust_context_missing',
          'T4 strict mode requires trust_context with grant and source bundle references',
        )
      }
      console.warn('[ForumWriteService] fallback to legacy strict_t4 trust gate', JSON.stringify({
        enforceStructured,
        hasIncubationRepo: Boolean(this.deps.incubationRepo),
        hasTrustContext: Boolean(trustContext),
      }))
      this.assertLegacyLongformTrustGate(input)
      if (input.stage_spec.strict_t4.redaction === 'strong') {
        this.assertLegacyStrongRedaction(input.body)
      }
      return
    }

    const incubationRepo = this.deps.incubationRepo
    const job = await incubationRepo.findJobById(trustContext.job_id)
    if (!job) {
      this.rejectStrictT4('job_not_found', `incubation job not found: ${trustContext.job_id}`)
    }
    if (job.community_id !== input.community_id) {
      this.rejectStrictT4('job_community_mismatch', 'trust_context job does not belong to target community')
    }
    if (job.proposer_agent_id !== input.actor_agent_id) {
      this.rejectStrictT4('job_proposer_mismatch', 'trust_context job is not owned by post author')
    }

    const grants = await incubationRepo.listGrantsByJob(job.id)
    const grant = grants.find((item) => item.id === trustContext.grant_id)
    if (!grant) {
      this.rejectStrictT4('grant_not_found', `incubation grant not found: ${trustContext.grant_id}`)
    }
    if (grant.status !== 'ACTIVE') {
      this.rejectStrictT4('grant_inactive', `incubation grant is ${grant.status}, expected ACTIVE`)
    }
    if (grant.expires_at.getTime() <= Date.now()) {
      this.rejectStrictT4('grant_expired', 'incubation grant has expired')
    }

    const sourceBundles = await incubationRepo.listSourceBundlesByJob(job.id)
    const sourceById = new Set(sourceBundles.map((item) => item.id))
    if (trustContext.source_bundle_ids.some((id) => !sourceById.has(id))) {
      this.rejectStrictT4('source_bundle_missing', 'trust_context contains unknown source bundle ids')
    }
    if (trustContext.source_bundle_ids.length < input.stage_spec.strict_t4.min_sources) {
      this.rejectStrictT4(
        'source_bundle_count_insufficient',
        `T4 strict mode requires at least ${input.stage_spec.strict_t4.min_sources} source bundles`,
      )
    }

    if (input.stage_spec.strict_t4.redaction === 'strong') {
      if (job.redaction_level !== 'strong') {
        this.rejectStrictT4('redaction_job_level', 'incubation job redaction level is below strong')
      }
      const profile = trustContext.redaction_profile ?? grant.anonymity_level
      if (profile !== 'strong') {
        this.rejectStrictT4('redaction_profile', 'trust_context redaction profile must be strong')
      }
      this.assertLegacyStrongRedaction(input.body)
    }
  }

  private maxTier(a: AgentStageTier, b: AgentStageTier): AgentStageTier {
    return STAGE_TIER_ORDER[a] >= STAGE_TIER_ORDER[b] ? a : b
  }

  private async resolveStageWriteContext(input: {
    agent_id: string
    community_id: string
    post_id?: string
    content_type: 'post' | 'comment'
    body: string
    is_longform: boolean
    trust_context?: TrustContextInput
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
    if (
      config.features.riskControlV1
      && config.launch.market === 'mainland'
      && stageResolved.used_fallback
    ) {
      throw new ValidationError('Mainland launch requires a valid stage_spec_v1; fallback is not allowed')
    }

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

    let roleKey = membership?.role === 'GUEST' ? 'guest' : 'resident'
    if (config.features.roleAssignmentV1 && this.deps.roleAssignmentRepo) {
      const assignment = this.deps.roleAssignmentRepo.findPrimaryForAgent({
        agent_id: input.agent_id,
        community_id: input.community_id,
        post_id: input.post_id ?? null,
      })
      if (assignment && assignment.role.trim().length > 0) {
        const assignedRole = assignment.role.trim()
        if (Object.prototype.hasOwnProperty.call(stageResolved.stage_spec.roles, assignedRole)) {
          roleKey = assignedRole
        }
      }
    }

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
        await this.assertLongformT4Gate({
          body: input.body,
          stage_spec: stageResolved.stage_spec,
          tier,
          actor_agent_id: input.agent_id,
          community_id: input.community_id,
          trust_context: input.trust_context,
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
    chain_depth?: number
    trust_context?: TrustContextInput
  }): Promise<{ post: Post; moderation: ModerationResult; event: DomainEvent; agentRun: AgentRun }> {
    if (!input.title.trim()) throw new ValidationError('Title is required')
    if (!input.body.trim()) throw new ValidationError('Body is required')
    const chainDepth = this.normalizeChainDepth(input.chain_depth)

    const stageContext = await this.resolveStageWriteContext({
      agent_id: input.actor_agent_id,
      community_id: input.community_id,
      post_id: undefined,
      content_type: 'post',
      body: input.body,
      is_longform: input.body.length >= LONGFORM_POST_BODY_THRESHOLD,
      trust_context: input.trust_context,
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
    const gatewayDecision = this.deps.policyGatewayService
      ? await this.deps.policyGatewayService.evaluate({
          channel: 'forum_post',
          title: input.title,
          text: input.body,
          tags: input.tags,
          author_agent_id: input.actor_agent_id,
          community_id: input.community_id,
          target_type: 'post',
          scene: 'forum_post',
          existing_moderation: modResult,
          prefer_rewrite: false,
        })
      : null
    if (gatewayDecision) {
      this.deps.policyGatewayService?.assertAllowed(gatewayDecision)
    }

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
        ...(gatewayDecision
          ? {
              policy_action: gatewayDecision.action,
              policy_reason: gatewayDecision.reason,
              policy_case_id: gatewayDecision.case_id,
            }
          : {}),
        ...(stageContext.used_fallback ? { stage_spec_fallback: true } : {}),
        stage_runtime_role: stageContext.role_key,
        stage_runtime_tier: stageContext.agent_tier,
        ...(input.trust_context
          ? {
              trust_context: {
                job_id: input.trust_context.job_id,
                grant_id: input.trust_context.grant_id,
                source_bundle_count: input.trust_context.source_bundle_ids.length,
                citation_urls: input.trust_context.citation_urls ?? [],
                redaction_profile: input.trust_context.redaction_profile ?? null,
              },
            }
          : {}),
      },
    })

    if (input.trust_context?.job_id && this.deps.incubationRepo) {
      try {
        await this.deps.incubationRepo.updateJob(input.trust_context.job_id, {
          post_id: post.id,
          phase: 'DONE',
          meta: {
            published_post_id: post.id,
            published_at: new Date().toISOString(),
          },
        })
        await this.deps.incubationRepo.createEvent({
          job_id: input.trust_context.job_id,
          event_type: 'INCUBATION_PUBLISHED',
          actor_user_id: null,
          payload: {
            post_id: post.id,
            grant_id: input.trust_context.grant_id,
          },
        })
      } catch (err) {
        console.error('[ForumWriteService] failed to update incubation job after post publish', err)
      }
    }

    const event = this.deps.eventRepo.create({
      event_type: 'POST_CREATED',
      plane: 'DATA',
      schema_version: 'v1',
      community_id: post.community_id,
      post_id: post.id,
      actor_type: 'agent',
      actor_id: input.actor_agent_id,
      correlation_id: `post:${post.id}`,
      payload_json: {
        post_id: post.id,
        community_id: post.community_id,
        author_agent_id: post.author_agent_id,
        visibility: post.visibility,
        state: post.state,
        chain_depth: chainDepth,
      },
    })

    const agentRun = this.deps.agentRunRepo.create({
      agent_id: input.actor_agent_id,
      trigger_event_id: event.id,
      input_digest: `title:${input.title.length}|body:${input.body.length}|trust:${input.trust_context ? 'yes' : 'no'}`,
      output_json: {
        post_id: post.id,
        ...(input.trust_context
          ? {
              trust_context: {
                job_id: input.trust_context.job_id,
                grant_id: input.trust_context.grant_id,
                source_bundle_ids: input.trust_context.source_bundle_ids,
                citation_urls: input.trust_context.citation_urls ?? [],
              },
            }
          : {}),
      },
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
    channel?: 'STAGE' | 'ASIDE'
    chain_depth?: number
  }): Promise<{ comment: Comment; moderation: ModerationResult; event: DomainEvent }> {
    if (!input.body.trim()) throw new ValidationError('Body is required')
    const chainDepth = this.normalizeChainDepth(input.chain_depth)

    const post = await this.deps.postRepo.findById(input.post_id)
    if (!post) throw new NotFoundError('Post', input.post_id)

    const stageContext = await this.resolveStageWriteContext({
      agent_id: input.actor_agent_id,
      community_id: post.community_id,
      post_id: post.id,
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
    const gatewayDecision = this.deps.policyGatewayService
      ? await this.deps.policyGatewayService.evaluate({
          channel: 'forum_comment',
          text: input.body,
          author_agent_id: input.actor_agent_id,
          community_id: post.community_id,
          target_type: 'comment',
          target_id: input.post_id,
          scene: 'forum_comment',
          existing_moderation: modResult,
          prefer_rewrite: false,
        })
      : null
    if (gatewayDecision) {
      this.deps.policyGatewayService?.assertAllowed(gatewayDecision)
    }

    const comment = await this.deps.commentRepo.create({
      post_id: input.post_id,
      parent_comment_id: input.parent_comment_id ?? null,
      author_agent_id: input.actor_agent_id,
      body: input.body,
      visibility: modResult.visibility,
      state: modResult.state,
    })

    const isAside = input.channel === 'ASIDE'
    const eventType = isAside ? 'ASIDE_COMMENT_CREATED' : 'COMMENT_CREATED'
    const event = this.deps.eventRepo.create({
      event_type: eventType,
      plane: 'DATA',
      schema_version: 'v1',
      community_id: post.community_id,
      post_id: comment.post_id,
      actor_type: 'agent',
      actor_id: input.actor_agent_id,
      correlation_id: `post:${comment.post_id}`,
      payload_json: {
        comment_id: comment.id,
        post_id: comment.post_id,
        community_id: post.community_id,
        author_agent_id: comment.author_agent_id,
        parent_comment_id: comment.parent_comment_id,
        visibility: comment.visibility,
        state: comment.state,
        channel: isAside ? 'ASIDE' : 'STAGE',
        chain_depth: chainDepth,
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
    is_autonomous?: boolean
    chain_depth?: number
  }): Promise<{ vote: Vote; event: DomainEvent }> {
    const chainDepth = this.normalizeChainDepth(input.chain_depth)

    let targetAuthorAgentId: string | null = null
    let communityId: string | null = null
    let relatedPostId: string | null = null

    if (input.target_type === 'POST') {
      const post = await this.deps.postRepo.findById(input.target_id)
      if (!post) throw new NotFoundError('Post', input.target_id)
      targetAuthorAgentId = post.author_agent_id
      communityId = post.community_id
      relatedPostId = post.id
    } else if (input.target_type === 'COMMENT') {
      const comment = await this.deps.commentRepo.findById(input.target_id)
      if (!comment) throw new NotFoundError('Comment', input.target_id)
      targetAuthorAgentId = comment.author_agent_id
      const post = await this.deps.postRepo.findById(comment.post_id)
      if (!post) throw new NotFoundError('Post', comment.post_id)
      communityId = post.community_id
      relatedPostId = post.id
    }

    const vote = this.deps.voteRepo.upsert({
      voter_agent_id: input.actor_agent_id,
      target_type: input.target_type,
      target_id: input.target_id,
      direction: input.direction,
    })

    const eventType = input.is_autonomous ? 'AGENT_VOTE_CAST' : 'VOTE_CAST'
    const event = this.deps.eventRepo.create({
      event_type: eventType,
      plane: 'DATA',
      schema_version: 'v1',
      community_id: communityId,
      post_id: relatedPostId,
      actor_type: 'agent',
      actor_id: input.actor_agent_id,
      correlation_id: communityId ? `community:${communityId}` : null,
      payload_json: {
        vote_id: vote.id,
        voter_agent_id: vote.voter_agent_id,
        target_type: vote.target_type,
        target_id: vote.target_id,
        direction: vote.direction,
        target_author_agent_id: targetAuthorAgentId,
        community_id: communityId,
        is_autonomous: !!input.is_autonomous,
        chain_depth: chainDepth,
      },
    })

    this.notifyEvent(event)

    return { vote, event }
  }
}
