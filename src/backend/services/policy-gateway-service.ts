import { ValidationError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import type { ModerationResult } from '../moderation/types.js'
import type { ModerationEvaluator } from './forum-write-service.js'
import type { MessageDeliveryStatus } from '../repos/types.js'
import type { HotTopicPolicyService } from './hot-topic-policy-service.js'
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
}

export class PolicyGatewayService {
  constructor(private readonly deps: {
    moderator: ModerationEvaluator
    safeReplyService: SafeReplyService
    hotTopicPolicyService: HotTopicPolicyService
    riskEventService: RiskEventService
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
    const moderation = input.existing_moderation ?? this.deps.moderator.evaluate({
      text: textForModeration,
      author_agent_id: input.author_agent_id,
      community_id: input.community_id ?? 'global',
      content_type: input.channel === 'forum_post'
        ? 'post'
        : input.channel === 'forum_comment'
          ? 'comment'
          : 'message',
    })

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
      },
      evidence: {
        moderation,
        hot_topic: hotTopic,
      },
      open_case:
        moderation.state === 'PENDING'
        || moderation.risk_level === 'high'
        || action === 'block'
        || Boolean(hotTopic?.drift_detected),
    })

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
      },
      shadowed,
      case_id: outcome.case?.id ?? null,
    }
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
}
