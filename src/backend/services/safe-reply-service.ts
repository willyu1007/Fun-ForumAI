import type { ModerationResult } from '../moderation/types.js'
import type { MessageDeliveryStatus } from '../repos/types.js'

export type SafeReplyScene =
  | 'forum_post'
  | 'forum_thread'
  | 'forum_turn'
  | 'chat_room'
  | 'private_inbound'
  | 'private_outbound'
  | 'proactive_dm'

export interface SafeReplyResult {
  action: 'allow' | 'rewrite' | 'block'
  text: string
  delivery_status: MessageDeliveryStatus
  rewrite_cause: string | null
  reason: string
}

export class SafeReplyService {
  rewriteOrRefuse(input: {
    scene: SafeReplyScene
    text: string
    moderation: ModerationResult
    preferRewrite?: boolean
  }): SafeReplyResult {
    const { moderation } = input
    const redline = this.isRedline(moderation)
    if (redline) {
      return {
        action: 'block',
        text: this.buildRefusalText(input.scene),
        delivery_status: 'BLOCKED',
        rewrite_cause: null,
        reason: 'redline_policy_block',
      }
    }

    const shouldRewrite = input.preferRewrite !== false
      && (moderation.risk_level === 'high' || moderation.state === 'PENDING')
    if (!shouldRewrite) {
      return {
        action: 'allow',
        text: input.text,
        delivery_status: 'DELIVERED',
        rewrite_cause: null,
        reason: 'policy_allow',
      }
    }

    return {
      action: 'rewrite',
      text: this.buildRewriteText(input.scene, input.text),
      delivery_status: 'REWRITTEN',
      rewrite_cause: 'high_risk_deescalated',
      reason: 'high_risk_rewrite',
    }
  }

  buildRefusalText(scene: SafeReplyScene): string {
    switch (scene) {
      case 'private_inbound':
        return '这条消息因触发安全规则未被送达，请改用更克制、非敏感的表达。'
      case 'private_outbound':
      case 'proactive_dm':
        return '我先不沿着这个方向继续，我们可以换成公开、非敏感的话题。'
      case 'chat_room':
        return '我换个安全一点的方向，继续聊公开且非敏感的话题。'
      default:
        return '内容触发安全规则，未予发布。'
    }
  }

  private isRedline(moderation: ModerationResult): boolean {
    if (moderation.verdict === 'REJECT') return true
    return moderation.details.rule_filter.matched_rules.some((rule) => rule.severity === 'block')
  }

  private buildRewriteText(scene: SafeReplyScene, text: string): string {
    const normalized = text
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120)

    switch (scene) {
      case 'private_inbound':
        return `我换个更克制的说法：我想继续讨论这件事，但不带攻击、诱导或隐私细节。`
      case 'private_outbound':
      case 'proactive_dm':
        return `我换个更稳妥的表达：我们只讨论公开、非敏感、不过度刺激的话题。`
      case 'chat_room':
        return normalized
          ? `我收敛一下说法：我们聚焦公开信息和理性讨论，不延展到敏感或过激方向。`
          : '我收敛一下说法：我们继续保持理性、公开和非敏感的讨论。'
      default:
        return normalized
          ? `内容已做降温处理：${normalized}`
          : '内容已做降温处理。'
    }
  }
}
