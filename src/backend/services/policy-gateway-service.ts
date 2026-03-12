import { ValidationError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import type { ModerationResult } from '../moderation/types.js'
import type { ModerationEvaluator } from './forum-write-service.js'
import type { MessageDeliveryStatus } from '../repos/types.js'
import type { HotTopicPolicyService } from './hot-topic-policy-service.js'
import type { PublicDisclosureCapService } from './public-disclosure-cap-service.js'
import type { RiskEventService } from './risk-event-service.js'
import type { SafeReplyService } from './safe-reply-service.js'

export type PolicyGatewayChannel =
  | 'forum_post'
  | 'forum_comment'
  | 'chat_room'
  | 'private_inbound'
  | 'private_outbound'
  | 'proactive_dm'

export interface PolicyGatewayResult {
  action: 'allow' | 'rewrite' | 'block'
  final_text: string
  moderation: ModerationResult
  delivery_status: MessageDeliveryStatus
  rewrite_cause: string | null
  reason: string
  metadata: Record<string, unknown>
  shadowed: boolean
  case_id: string | null
  policy_snapshot_id: string | null
  risk_event_id: string | null
}

interface SpilloverHit {
  category: 'owner_endorsement_public' | 'owner_private_leak'
  matched_pattern: string
  reason: string
}

interface SpilloverEnforcement {
  action: PolicyGatewayResult['action']
  delivery_status: MessageDeliveryStatus
  rewrite_cause: string
  reason: string
  refusal_text: string
  override_cap_level: 0 | 1
  override_source: 'owner_endorsement_public' | 'owner_private_leak'
}

const OWNER_PRIVATE_LEAK_RESPONSE = '请不要公开转述 Owner 或私聊中的原话，换成不涉及私域来源的公开表达。'
const OWNER_ENDORSEMENT_RESPONSE = '请改成你自己的公开观点，不要把 Owner 的立场或授意直接带入公共场景。'

const OWNER_PRIVATE_LEAK_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /(?:我的\s*owner|owner|主人|私聊|私信|私人聊天|private chat|private dm).{0,12}(?:说(?:[：:“"'，,\s]|过|道|了)|提到|告诉我|写道|said|told me)/i, label: 'owner_or_private_chat_direct_speech' },
  { pattern: /(?:我的\s*owner|owner|主人|私聊|私信|私人聊天|private chat|private dm).{0,20}[“"'「『].{1,120}[”"'」』]/i, label: 'owner_or_private_chat_quote' },
  { pattern: /(?:根据|依照|按照|转述|透露|爆料).{0,12}(?:我的\s*owner|owner|私聊|私信|private chat)/i, label: 'owner_private_relay' },
]

const OWNER_ENDORSEMENT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /(?:我的\s*owner|owner|主人).{0,12}(?:认为|觉得|要求|希望|指示|建议|believes|thinks|wants)/i, label: 'owner_endorsement' },
  { pattern: /(?:我的\s*owner|owner|主人).{0,12}(?:让我|要求我|指示我|asked me to|told me to).{0,20}(?:公开|发布|发(?:出(?:来)?)?|转达|告诉(?:大家|你们|你)|代为|代表|表态|宣传|声明|announce|share|post|say|speak|endorse)/i, label: 'owner_public_instruction' },
  { pattern: /(?:代表|代替).{0,12}(?:我的\s*owner|owner|主人)/i, label: 'owner_as_principal' },
  { pattern: /(?:according to|per)\s+my\s+owner/i, label: 'according_to_owner' },
]

export class PolicyGatewayService {
  constructor(private readonly deps: {
    moderator: ModerationEvaluator
    safeReplyService: SafeReplyService
    hotTopicPolicyService: HotTopicPolicyService
    riskEventService: RiskEventService
    publicDisclosureCapService: PublicDisclosureCapService
  }) {}

  async evaluate(input: {
    channel: PolicyGatewayChannel
    text: string
    title?: string
    tags?: string[]
    author_agent_id: string
    community_id?: string | null
    user_id?: string | null
    target_type: string
    target_id?: string | null
    room_id?: string | null
    session_id?: string | null
    message_id?: string | null
    scene?: string | null
    existing_moderation?: ModerationResult
    prefer_rewrite?: boolean
  }): Promise<PolicyGatewayResult> {
    const textForModeration = input.title ? `${input.title}\n\n${input.text}` : input.text
    const moderationBase = input.existing_moderation ?? this.deps.moderator.evaluate({
      text: textForModeration,
      author_agent_id: input.author_agent_id,
      community_id: input.community_id ?? 'global',
      content_type: input.channel === 'forum_post'
        ? 'post'
        : input.channel === 'forum_comment'
          ? 'comment'
          : 'message',
    })
    const spillover = this.shouldGuardPublicChannel(input.channel)
      ? this.detectSpillover(textForModeration)
      : null
    const moderation = spillover
      ? this.applySpilloverRisk(moderationBase, spillover)
      : moderationBase

    const hotTopic = this.shouldApplyHotTopicPolicy(input.channel)
      ? this.deps.hotTopicPolicyService.evaluate({
          text: textForModeration,
          tags: input.tags,
        })
      : null

    let action: PolicyGatewayResult['action'] = 'allow'
    let final_text = input.text
    let delivery_status: MessageDeliveryStatus = 'DELIVERED'
    let rewrite_cause: string | null = null
    let reason = 'policy_allow'

    if (hotTopic && !hotTopic.allowed) {
      action = 'block'
      delivery_status = 'BLOCKED'
      reason = hotTopic.reason
    } else {
      const safeReply = this.deps.safeReplyService.rewriteOrRefuse({
        scene: this.mapScene(input.channel),
        text: input.text,
        moderation,
        preferRewrite: input.prefer_rewrite,
      })
      action = safeReply.action
      final_text = safeReply.text
      delivery_status = safeReply.delivery_status
      rewrite_cause = safeReply.rewrite_cause
      reason = safeReply.reason
    }

    const spilloverEnforcement = this.resolveSpilloverEnforcement({
      spillover,
      base_moderation: moderationBase,
      hot_topic: hotTopic,
    })
    if (spilloverEnforcement) {
      action = spilloverEnforcement.action
      final_text = spilloverEnforcement.refusal_text
      delivery_status = spilloverEnforcement.delivery_status
      rewrite_cause = spilloverEnforcement.rewrite_cause
      reason = spilloverEnforcement.reason
    }

    const enforced = this.isEnforced(input.channel)
    const shadowed = !enforced && (action === 'rewrite' || action === 'block')

    const outcome = await this.deps.riskEventService.recordModerationOutcome({
      text: textForModeration,
      channel: input.channel,
      target_type: input.target_type,
      target_id: input.target_id ?? null,
      community_id: input.community_id ?? null,
      agent_id: input.author_agent_id,
      user_id: input.user_id ?? null,
      room_id: input.room_id ?? null,
      session_id: input.session_id ?? null,
      message_id: input.message_id ?? null,
      scene: input.scene ?? null,
      action: shadowed ? 'allow' : action,
      reason: shadowed ? `shadow_${reason}` : reason,
      moderation,
      decision: {
        action,
        enforced,
        shadowed,
        rewrite_cause,
        delivery_status,
        hot_topic: hotTopic,
        spillover,
      },
      evidence: {
        moderation,
        hot_topic: hotTopic,
        spillover,
      },
      open_case:
        moderation.state === 'PENDING'
        || moderation.risk_level === 'high'
        || action === 'block'
        || Boolean(hotTopic?.drift_detected)
        || Boolean(spilloverEnforcement),
    })

    if (spilloverEnforcement && !shadowed) {
      await this.deps.publicDisclosureCapService.ensureAutomaticAgentOverride({
        agent_id: input.author_agent_id,
        cap_level: spilloverEnforcement.override_cap_level,
        source: spilloverEnforcement.override_source,
        reason: spilloverEnforcement.reason,
        linked_case_id: outcome.case?.id ?? null,
        linked_risk_event_id: outcome.risk_event.id,
      })
    }

    return {
      action: shadowed ? 'allow' : action,
      final_text: shadowed ? input.text : final_text,
      moderation,
      delivery_status: shadowed ? 'DELIVERED' : delivery_status,
      rewrite_cause: shadowed ? `shadow_${rewrite_cause ?? action}` : rewrite_cause,
      reason: shadowed ? `shadow_${reason}` : reason,
      metadata: {
        moderation,
        hot_topic: hotTopic,
        policy_action: action,
        policy_enforced: enforced,
        policy_shadowed: shadowed,
        rewrite_cause,
        spillover,
      },
      shadowed,
      case_id: outcome.case?.id ?? null,
      policy_snapshot_id: outcome.snapshot.id,
      risk_event_id: outcome.risk_event.id,
    }
  }

  async finalizeRecordedOutcomeTarget(
    result: Pick<PolicyGatewayResult, 'policy_snapshot_id' | 'risk_event_id' | 'case_id'>,
    target: {
      target_id: string
      room_id?: string | null
      session_id?: string | null
      message_id?: string | null
    },
  ): Promise<void> {
    await this.deps.riskEventService.rebindRecordedOutcomeTarget({
      policy_snapshot_id: result.policy_snapshot_id,
      risk_event_id: result.risk_event_id,
      case_id: result.case_id,
      target_id: target.target_id,
      room_id: target.room_id,
      session_id: target.session_id,
      message_id: target.message_id,
    })
  }

  assertAllowed(result: Pick<PolicyGatewayResult, 'action' | 'reason'>): void {
    if (result.action === 'block') {
      throw new ValidationError(result.reason)
    }
  }

  private shouldApplyHotTopicPolicy(channel: PolicyGatewayChannel): boolean {
    return config.features.hotTopicPolicyV1
      && (channel === 'forum_post' || channel === 'forum_comment' || channel === 'chat_room')
  }

  private shouldGuardPublicChannel(channel: PolicyGatewayChannel): boolean {
    return channel === 'forum_post' || channel === 'forum_comment' || channel === 'chat_room'
  }

  private isEnforced(channel: PolicyGatewayChannel): boolean {
    if (!config.features.riskControlV1) return false
    if (channel === 'forum_post' || channel === 'forum_comment') {
      return config.features.riskControlPublicEnforce
    }
    if (channel === 'chat_room') return config.features.riskControlChatEnforce
    if (channel === 'proactive_dm') return config.features.riskControlProactiveEnforce
    return config.features.riskControlPrivateEnforce
  }

  private mapScene(channel: PolicyGatewayChannel) {
    switch (channel) {
      case 'forum_post': return 'forum_post'
      case 'forum_comment': return 'forum_comment'
      case 'chat_room': return 'chat_room'
      case 'private_inbound': return 'private_inbound'
      case 'private_outbound': return 'private_outbound'
      case 'proactive_dm': return 'proactive_dm'
    }
  }

  private detectSpillover(text: string): SpilloverHit | null {
    for (const candidate of OWNER_PRIVATE_LEAK_PATTERNS) {
      if (candidate.pattern.test(text)) {
        return {
          category: 'owner_private_leak',
          matched_pattern: candidate.label,
          reason: 'owner_private_leak_detected',
        }
      }
    }

    for (const candidate of OWNER_ENDORSEMENT_PATTERNS) {
      if (candidate.pattern.test(text)) {
        return {
          category: 'owner_endorsement_public',
          matched_pattern: candidate.label,
          reason: 'owner_endorsement_public_detected',
        }
      }
    }

    return null
  }

  private applySpilloverRisk(
    moderation: ModerationResult,
    spillover: SpilloverHit,
  ): ModerationResult {
    const category = spillover.category
    const riskLevel = category === 'owner_private_leak'
      ? 'high'
      : moderation.risk_level === 'high'
        ? 'high'
        : 'medium'
    const riskScore = Math.max(
      moderation.risk_score,
      category === 'owner_private_leak' ? 0.95 : 0.65,
    )
    const riskCategories = Array.from(new Set([
      ...moderation.risk_categories.filter((item) => item !== 'clean'),
      category,
    ]))

    return {
      ...moderation,
      risk_level: riskLevel,
      risk_score: riskScore,
      risk_categories: riskCategories.length > 0 ? riskCategories : [category],
      details: {
        ...moderation.details,
        classifier_categories: Array.from(new Set([
          ...moderation.details.classifier_categories.filter((item) => item !== 'clean'),
          category,
        ])),
        decision_reason: `${moderation.details.decision_reason}; ${spillover.reason}`,
      },
    }
  }

  private resolveSpilloverEnforcement(input: {
    spillover: SpilloverHit | null
    base_moderation: ModerationResult
    hot_topic: ReturnType<HotTopicPolicyService['evaluate']> | null
  }): SpilloverEnforcement | null {
    if (!input.spillover) return null

    if (input.spillover.category === 'owner_private_leak') {
      return {
        action: 'block',
        delivery_status: 'BLOCKED',
        rewrite_cause: 'owner_private_leak',
        reason: 'owner_private_leak_blocked',
        refusal_text: OWNER_PRIVATE_LEAK_RESPONSE,
        override_cap_level: 0,
        override_source: 'owner_private_leak',
      }
    }

    const elevatedByRisk = input.base_moderation.risk_level === 'medium' || input.base_moderation.risk_level === 'high'
    const elevatedByTopic = Boolean(input.hot_topic?.drift_detected)
    if (!elevatedByRisk && !elevatedByTopic) {
      return null
    }

    return {
      action: 'block',
      delivery_status: 'BLOCKED',
      rewrite_cause: 'owner_endorsement_public',
      reason: elevatedByTopic
        ? 'owner_endorsement_public_hot_topic_blocked'
        : 'owner_endorsement_public_medium_risk_blocked',
      refusal_text: OWNER_ENDORSEMENT_RESPONSE,
      override_cap_level: 1,
      override_source: 'owner_endorsement_public',
    }
  }
}
