import { createHash } from 'node:crypto'
import type { ModerationResult } from '../moderation/types.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'
import type { ReviewCaseType, ReviewQueue } from '../repos/types.js'
import type { ReviewService } from './review-service.js'

function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function toObjectSection(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export class RiskEventService {
  constructor(
    private readonly riskRepo: RiskGovernanceRepository,
    private readonly reviewService: ReviewService,
  ) {}

  async recordModerationOutcome(input: {
    text: string
    channel: string
    target_type: string
    target_id?: string | null
    community_id?: string | null
    agent_id?: string | null
    user_id?: string | null
    room_id?: string | null
    session_id?: string | null
    message_id?: string | null
    scene?: string | null
    action: 'allow' | 'rewrite' | 'block'
    reason: string
    moderation: ModerationResult
    decision: Record<string, unknown>
    evidence?: Record<string, unknown>
    open_case?: boolean
    case_type?: ReviewCaseType
    queue?: ReviewQueue
    priority?: number
  }) {
    const content_hash = hashText(input.text.trim())
    const snapshot = await this.riskRepo.createPolicySnapshot({
      content_hash,
      channel: input.channel,
      target_type: input.target_type,
      target_id: input.target_id ?? null,
      community_id: input.community_id ?? null,
      agent_id: input.agent_id ?? null,
      user_id: input.user_id ?? null,
      scene: input.scene ?? null,
      normalized_text: input.text.trim(),
      moderation: input.moderation as unknown as Record<string, unknown>,
      decision: input.decision,
    })

    let moderationCase = null
    if (input.open_case) {
      moderationCase = await this.reviewService.openAutomatedCase({
        case_type: input.case_type,
        queue: input.queue,
        priority: input.priority,
        summary_text: `${input.channel} ${input.action}: ${input.reason}`,
        risk_summary: {
          source: 'policy_gateway',
          risk_level: input.moderation.risk_level,
          risk_score: input.moderation.risk_score,
          risk_categories: input.moderation.risk_categories,
        },
        opened_reason: input.reason,
        linked_policy_snapshot_id: snapshot.id,
        target: {
          case_id: '',
          target_type: input.target_type,
          target_id: input.target_id ?? snapshot.id,
          relation_type: 'PRIMARY',
          channel: input.channel,
          community_id: input.community_id ?? null,
          agent_id: input.agent_id ?? null,
          user_id: input.user_id ?? null,
          room_id: input.room_id ?? null,
          session_id: input.session_id ?? null,
          message_id: input.message_id ?? null,
        },
        evidence: [{
          case_id: '',
          snapshot_type: 'policy_evidence',
          payload: input.evidence ?? {},
          content: {
            normalized_text: input.text.trim(),
            action: input.action,
            reason: input.reason,
          },
          context: {
            channel: input.channel,
            target_type: input.target_type,
            target_id: input.target_id ?? snapshot.id,
            community_id: input.community_id ?? null,
            agent_id: input.agent_id ?? null,
            user_id: input.user_id ?? null,
            room_id: input.room_id ?? null,
            session_id: input.session_id ?? null,
            message_id: input.message_id ?? null,
            scene: input.scene ?? null,
          },
          policy_hits: {
            risk_level: input.moderation.risk_level,
            risk_score: input.moderation.risk_score,
            risk_categories: input.moderation.risk_categories,
            decision_reason: input.moderation.details.decision_reason,
            matched_rules: input.moderation.details.rule_filter.matched_rules,
            classifier_categories: input.moderation.details.classifier_categories,
          },
          prompt_memory: toObjectSection(input.evidence?.prompt_memory),
          topic_signals: toObjectSection(input.evidence?.topic_signals),
          action_history: {
            opened_case: true,
            decision: input.decision,
          },
        }],
      })
    }

    const event = await this.riskRepo.createRiskEvent({
      policy_snapshot_id: snapshot.id,
      case_id: moderationCase?.id ?? null,
      channel: input.channel,
      event_type: 'policy_gateway_decision',
      action: input.action,
      risk_level: input.moderation.risk_level,
      risk_score: input.moderation.risk_score,
      risk_categories: input.moderation.risk_categories,
      target_type: input.target_type,
      target_id: input.target_id ?? null,
      community_id: input.community_id ?? null,
      agent_id: input.agent_id ?? null,
      user_id: input.user_id ?? null,
      room_id: input.room_id ?? null,
      session_id: input.session_id ?? null,
      message_id: input.message_id ?? null,
      detail_text: input.reason,
      payload: input.decision,
    })

    return {
      snapshot,
      risk_event: event,
      case: moderationCase,
    }
  }

  async rebindRecordedOutcomeTarget(input: {
    policy_snapshot_id?: string | null
    risk_event_id?: string | null
    case_id?: string | null
    target_id: string
    room_id?: string | null
    session_id?: string | null
    message_id?: string | null
  }): Promise<void> {
    if (input.policy_snapshot_id) {
      await this.riskRepo.updatePolicySnapshot(input.policy_snapshot_id, {
        target_id: input.target_id,
      })
    }

    if (input.risk_event_id) {
      await this.riskRepo.updateRiskEvent(input.risk_event_id, {
        target_id: input.target_id,
        room_id: input.room_id,
        session_id: input.session_id,
        message_id: input.message_id,
      })
    }

    if (input.case_id) {
      await this.riskRepo.updateCaseTargets(input.case_id, {
        target_id: input.target_id,
        room_id: input.room_id,
        session_id: input.session_id,
        message_id: input.message_id,
      })
    }
  }
}
