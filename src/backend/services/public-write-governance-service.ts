import { createHash } from 'node:crypto'
import { config } from '../lib/config.js'
import { ForbiddenError, NotFoundError } from '../lib/errors.js'
import type { ModerationService } from '../moderation/moderation-service.js'
import type { EventRepository } from '../repos/event-repository.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'
import type { AgentRepository, Post, PostRepository } from '../repos/index.js'
import {
  FORUM_PUBLIC_WRITE_AUDIT_SCHEMA_VERSION as PUBLIC_WRITE_AUDIT_SCHEMA_VERSION,
  FORUM_PUBLIC_WRITE_RESULT_SCHEMA_VERSION as PUBLIC_WRITE_RESULT_SCHEMA_VERSION,
  type EffectiveParticipationContract,
  type PublicWriteAction,
  type PublicWriteActorRole,
  type PublicWriteAuditRecord,
  type PublicWriteFeatureFlagSnapshot,
  type PublicWriteModerationMode,
  type PublicWriteModerationState,
  type PublicWriteOutcome,
  type PublicWriteResult,
  type ViewerWriteSourceContext,
} from '../../shared/forum-orchestration.js'
import type { ParticipationContractService } from './participation-contract-service.js'

const RISK_EVENT_CHANNEL = 'forum_public_write'
const RESULT_EVENT_TYPE = 'VIEWER_PUBLIC_WRITE_RECORDED'

const RATE_LIMIT_PROFILES: Record<PublicWriteAction, { window_ms: number; max_events: number }> = {
  CREATE_PUBLIC_THREAD: { window_ms: 10 * 60 * 1000, max_events: 3 },
  CREATE_PUBLIC_TURN: { window_ms: 10 * 60 * 1000, max_events: 12 },
  CREATE_AUDIENCE_MESSAGE: { window_ms: 10 * 60 * 1000, max_events: 20 },
}

export interface PublicWriteGovernanceServiceDeps {
  postRepo: PostRepository
  agentRepo: Pick<AgentRepository, 'findById'>
  participationContractService: Pick<ParticipationContractService, 'getPostContract'>
  moderator: Pick<ModerationService, 'evaluate'>
  riskRepo: RiskGovernanceRepository
  eventRepo: EventRepository
}

interface GovernWriteInput {
  action: PublicWriteAction
  actor_user_id: string
  actor_role: 'user' | 'admin'
  post_id: string
  thread_id?: string | null
  body: string
  idempotency_key?: string | null
  client_ip: string | null
  source_context?: ViewerWriteSourceContext | null
  executeAcceptedWrite: () => Promise<{
    thread_id: string | null
    turn_id: string | null
    audience_message_id: string | null
  }>
}

export class PublicWriteGovernanceService {
  constructor(private readonly deps: PublicWriteGovernanceServiceDeps) {}

  async handleWrite(input: GovernWriteInput): Promise<PublicWriteResult> {
    const existing = this.resolveExistingResult(input.idempotency_key)
    if (existing) {
      return existing
    }

    const post = await this.requirePost(input.post_id)
    const contract = await this.deps.participationContractService.getPostContract(post.id)

    this.assertFeatureEnabled(input.action)
    this.assertActionAllowed(input.action, contract)

    const actorRole = this.resolveActorRole(post, input.actor_user_id, input.actor_role)
    const featureFlagSnapshot = this.snapshotFeatureFlags()
    const clientIpHash = hashClientIp(input.client_ip)

    if (await this.isRateLimited(input.action, input.actor_user_id)) {
      return this.recordOutcome({
        action: input.action,
        result: 'RATE_LIMITED',
        post,
        contract,
        actor_user_id: input.actor_user_id,
        actor_role: actorRole,
        client_ip_hash: clientIpHash,
        thread_id: input.thread_id ?? null,
        turn_id: null,
        audience_message_id: null,
        idempotency_key: input.idempotency_key ?? null,
        source_context: input.source_context ?? null,
        feature_flag_snapshot: featureFlagSnapshot,
        moderation_mode: this.resolveModerationMode(input.action, featureFlagSnapshot),
        moderation_state: 'RATE_LIMITED',
        reason: '发送过于频繁，请稍后重试。',
      })
    }

    const moderationMode = this.resolveModerationMode(input.action, featureFlagSnapshot)
    if (moderationMode === 'AUTO_HOLD') {
      return this.recordOutcome({
        action: input.action,
        result: 'PENDING_MODERATION',
        post,
        contract,
        actor_user_id: input.actor_user_id,
        actor_role: actorRole,
        client_ip_hash: clientIpHash,
        thread_id: input.thread_id ?? null,
        turn_id: null,
        audience_message_id: null,
        idempotency_key: input.idempotency_key ?? null,
        source_context: input.source_context ?? null,
        feature_flag_snapshot: featureFlagSnapshot,
        moderation_mode: moderationMode,
        moderation_state: 'HELD',
        reason: '内容已收到，正在等待审核。',
      })
    }

    const moderationDecision = moderationMode === 'RULE_BASED'
      ? this.deps.moderator.evaluate({
        text: input.body,
        author_agent_id: post.author_agent_id,
        community_id: post.community_id,
        content_type: input.action === 'CREATE_AUDIENCE_MESSAGE' ? 'message' : 'thread_turn',
      })
      : null

    if (moderationDecision && (moderationDecision.verdict === 'REJECT' || moderationDecision.state === 'REJECTED')) {
      return this.recordOutcome({
        action: input.action,
        result: 'REJECTED',
        post,
        contract,
        actor_user_id: input.actor_user_id,
        actor_role: actorRole,
        client_ip_hash: clientIpHash,
        thread_id: input.thread_id ?? null,
        turn_id: null,
        audience_message_id: null,
        idempotency_key: input.idempotency_key ?? null,
        source_context: input.source_context ?? null,
        feature_flag_snapshot: featureFlagSnapshot,
        moderation_mode: moderationMode,
        moderation_state: 'REJECTED',
        reason: '内容未通过发布规则，请修改后重试。',
      })
    }

    if (moderationDecision && moderationDecision.state !== 'APPROVED') {
      return this.recordOutcome({
        action: input.action,
        result: 'PENDING_MODERATION',
        post,
        contract,
        actor_user_id: input.actor_user_id,
        actor_role: actorRole,
        client_ip_hash: clientIpHash,
        thread_id: input.thread_id ?? null,
        turn_id: null,
        audience_message_id: null,
        idempotency_key: input.idempotency_key ?? null,
        source_context: input.source_context ?? null,
        feature_flag_snapshot: featureFlagSnapshot,
        moderation_mode: moderationMode,
        moderation_state: 'HELD',
        reason: '内容已收到，正在等待审核。',
      })
    }

    const created = await input.executeAcceptedWrite()
    return this.recordOutcome({
      action: input.action,
      result: 'ACCEPTED',
      post,
      contract,
      actor_user_id: input.actor_user_id,
      actor_role: actorRole,
      client_ip_hash: clientIpHash,
      thread_id: created.thread_id,
      turn_id: created.turn_id,
      audience_message_id: created.audience_message_id,
      idempotency_key: input.idempotency_key ?? null,
      source_context: input.source_context ?? null,
      feature_flag_snapshot: featureFlagSnapshot,
      moderation_mode: moderationMode,
      moderation_state: moderationMode === 'RULE_BASED' ? 'APPROVED' : 'AUTO_APPROVED',
      reason: successMessage(input.action),
    })
  }

  private async requirePost(postId: string): Promise<Post> {
    const post = await this.deps.postRepo.findById(postId)
    if (!post) {
      throw new NotFoundError('Post', postId)
    }
    return post
  }

  private resolveActorRole(
    post: Post,
    actorUserId: string,
    actorRole: 'user' | 'admin',
  ): PublicWriteActorRole {
    if (actorRole === 'admin') {
      return 'ADMIN'
    }

    const authorAgent = this.deps.agentRepo.findById(post.author_agent_id)
    if (authorAgent?.owner_id === actorUserId) {
      return 'POST_OWNER'
    }

    return 'VIEWER'
  }

  private assertFeatureEnabled(action: PublicWriteAction): void {
    if (!config.features.humanParticipationV1) {
      throw new ForbiddenError('Human participation is disabled by feature flag')
    }

    if (action === 'CREATE_AUDIENCE_MESSAGE' && !config.features.audienceZoneV1) {
      throw new ForbiddenError('Audience API is disabled by feature flag')
    }
  }

  private assertActionAllowed(action: PublicWriteAction, contract: EffectiveParticipationContract): void {
    if (action === 'CREATE_PUBLIC_THREAD' && !contract.stage_open_reply.new_thread_enabled) {
      throw new ForbiddenError('Post does not allow viewer thread entry on the main stage')
    }
    if (action === 'CREATE_PUBLIC_TURN' && !contract.stage_open_reply.turn_reply_enabled) {
      throw new ForbiddenError('Post does not allow viewer turn replies on the main stage')
    }
    if (action === 'CREATE_AUDIENCE_MESSAGE' && !contract.audience_lane.posting_enabled) {
      throw new ForbiddenError('Post does not allow viewer audience messages')
    }
  }

  private snapshotFeatureFlags(): PublicWriteFeatureFlagSnapshot {
    return {
      humanParticipationV1: config.features.humanParticipationV1,
      audienceZoneV1: config.features.audienceZoneV1,
      riskControlV1: config.features.riskControlV1,
      riskControlPublicEnforce: config.features.riskControlPublicEnforce,
    }
  }

  private resolveModerationMode(
    action: PublicWriteAction,
    flags: PublicWriteFeatureFlagSnapshot,
  ): PublicWriteModerationMode {
    if (!flags.riskControlV1) {
      return 'AUTO_APPROVE'
    }
    if (!flags.riskControlPublicEnforce) {
      return 'AUTO_HOLD'
    }
    return action === 'CREATE_AUDIENCE_MESSAGE' ? 'RULE_BASED' : 'RULE_BASED'
  }

  private async isRateLimited(action: PublicWriteAction, actorUserId: string): Promise<boolean> {
    if (!config.features.riskControlV1 || !config.features.riskControlPublicEnforce) {
      return false
    }

    const profile = RATE_LIMIT_PROFILES[action]
    const events = await this.deps.riskRepo.listRiskEvents({
      limit: 200,
      user_id: actorUserId,
      channel: RISK_EVENT_CHANNEL,
    })
    const cutoff = Date.now() - profile.window_ms
    const recentCount = events.items.filter((event) =>
      event.action === action && event.created_at.getTime() >= cutoff).length
    return recentCount >= profile.max_events
  }

  private resolveExistingResult(idempotencyKey: string | null | undefined): PublicWriteResult | null {
    if (!idempotencyKey) {
      return null
    }

    const existing = this.deps.eventRepo.findByIdempotencyKey(idempotencyKey)
    if (!existing || !isRecord(existing.payload_json)) {
      return null
    }

    const payload = existing.payload_json.result
    if (!isRecord(payload)) {
      return null
    }

    const action = readAction(payload.action)
    const result = readOutcome(payload.result)
    if (!action || !result) {
      return null
    }

    return {
      schema_version: PUBLIC_WRITE_RESULT_SCHEMA_VERSION,
      action,
      result,
      audit_id: typeof payload.audit_id === 'string' ? payload.audit_id : existing.id,
      thread_id: readNullableString(payload.thread_id),
      turn_id: readNullableString(payload.turn_id),
      audience_message_id: readNullableString(payload.audience_message_id),
      message: readNullableString(payload.message),
    }
  }

  private async recordOutcome(input: {
    action: PublicWriteAction
    result: PublicWriteOutcome
    post: Post
    contract: EffectiveParticipationContract
    actor_user_id: string
    actor_role: PublicWriteActorRole
    client_ip_hash: string | null
    thread_id: string | null
    turn_id: string | null
    audience_message_id: string | null
    idempotency_key: string | null
    source_context: ViewerWriteSourceContext | null
    feature_flag_snapshot: PublicWriteFeatureFlagSnapshot
    moderation_mode: PublicWriteModerationMode
    moderation_state: PublicWriteModerationState
    reason: string
  }): Promise<PublicWriteResult> {
    const createdAt = new Date()
    const riskEvent = await this.deps.riskRepo.createRiskEvent({
      channel: RISK_EVENT_CHANNEL,
      event_type: 'public_write_result',
      action: input.action,
      target_type: auditTargetType(input.action),
      target_id: input.turn_id ?? input.audience_message_id ?? input.thread_id ?? input.post.id,
      community_id: input.post.community_id,
      agent_id: input.post.author_agent_id,
      user_id: input.actor_user_id,
      session_id: null,
      detail_text: input.reason,
      payload: null,
    })

    const auditRecord: PublicWriteAuditRecord = {
      schema_version: PUBLIC_WRITE_AUDIT_SCHEMA_VERSION,
      audit_id: riskEvent.id,
      action: input.action,
      result: input.result,
      actor_user_id: input.actor_user_id,
      actor_role: input.actor_role,
      community_id: input.post.community_id,
      post_id: input.post.id,
      thread_id: input.thread_id,
      turn_id: input.turn_id,
      audience_message_id: input.audience_message_id,
      session_id: null,
      client_ip_hash: input.client_ip_hash,
      source_context: input.source_context,
      feature_flag_snapshot: input.feature_flag_snapshot,
      moderation_mode: input.moderation_mode,
      moderation_state: input.moderation_state,
      contract_source: input.contract.source,
      reason: input.reason,
      created_at: createdAt.toISOString(),
    }
    await this.deps.riskRepo.updateRiskEvent(riskEvent.id, {
      payload: {
        audit_record: auditRecord,
      },
    })

    const result: PublicWriteResult = {
      schema_version: PUBLIC_WRITE_RESULT_SCHEMA_VERSION,
      action: input.action,
      result: input.result,
      audit_id: auditRecord.audit_id,
      thread_id: input.result === 'ACCEPTED' ? input.thread_id : null,
      turn_id: input.result === 'ACCEPTED' ? input.turn_id : null,
      audience_message_id: input.result === 'ACCEPTED' ? input.audience_message_id : null,
      message: input.reason,
    }

    this.deps.eventRepo.create({
      event_type: RESULT_EVENT_TYPE,
      plane: 'CONTROL',
      schema_version: 'v1',
      community_id: input.post.community_id,
      post_id: input.post.id,
      actor_type: 'human',
      actor_id: input.actor_user_id,
      correlation_id: `post:${input.post.id}`,
      idempotency_key: input.idempotency_key ?? null,
      payload_json: {
        result,
        audit_record: auditRecord,
      },
    })

    return result
  }
}

function hashClientIp(value: string | null): string | null {
  if (!value) return null
  return createHash('sha256').update(value).digest('hex')
}

function successMessage(action: PublicWriteAction): string {
  if (action === 'CREATE_PUBLIC_THREAD') return '公开分支已发布。'
  if (action === 'CREATE_PUBLIC_TURN') return '公开回应已发布。'
  return '观众留言已发布。'
}

function auditTargetType(action: PublicWriteAction): string {
  if (action === 'CREATE_PUBLIC_THREAD') return 'viewer_public_thread'
  if (action === 'CREATE_PUBLIC_TURN') return 'viewer_public_turn'
  return 'viewer_audience_message'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readAction(value: unknown): PublicWriteAction | null {
  return value === 'CREATE_PUBLIC_THREAD'
    || value === 'CREATE_PUBLIC_TURN'
    || value === 'CREATE_AUDIENCE_MESSAGE'
    ? value
    : null
}

function readOutcome(value: unknown): PublicWriteOutcome | null {
  return value === 'ACCEPTED'
    || value === 'PENDING_MODERATION'
    || value === 'REJECTED'
    || value === 'RATE_LIMITED'
    ? value
    : null
}
