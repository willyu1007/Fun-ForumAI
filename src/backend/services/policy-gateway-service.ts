import { ValidationError } from '../lib/errors.js'
import { config } from '../lib/config.js'
import type { ModerationResult } from '../moderation/types.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import type { MessageDeliveryStatus, ReviewCaseType, ReviewQueue } from '../repos/types.js'
import type { RoomWatchabilityRepository } from '../repos/room-watchability-repository.js'
import type { HotTopicDistributionState, HotTopicPolicyService } from './hot-topic-policy-service.js'
import type { PublicDisclosureCapService } from './public-disclosure-cap-service.js'
import type { RiskEventService } from './risk-event-service.js'
import type { SafeReplyService } from './safe-reply-service.js'
import type { ModerationEvaluator } from './forum-write-service.js'
import {
  DEFAULT_ALLOWED_HOT_TOPIC_DOMAINS,
  hasNoRecommendTag,
  pickStricterHotTopicMode,
  readCommunityHotTopicPolicyV1,
  readRoomHotTopicMode,
  type CommunityHotTopicPolicyV1,
  type HotTopicMode,
} from './hot-topic-policy-config.js'

export type PolicyGatewayChannel =
  | 'forum_post'
  | 'forum_thread'
  | 'forum_turn'
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
  visibility_override: 'PUBLIC' | 'GRAY' | 'QUARANTINE' | null
  state_override: 'APPROVED' | 'PENDING' | 'REJECTED' | null
  distribution_state: HotTopicDistributionState
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

interface HotTopicKillSwitchHit {
  source: 'room_override' | 'community_scene_override' | 'community_mode' | 'agent_status'
  mode: HotTopicMode
  detail: string
}

interface ResolvedHotTopicPolicyContext {
  community_policy: CommunityHotTopicPolicyV1
  effective_mode: HotTopicMode
  effective_source: HotTopicKillSwitchHit['source'] | 'default'
  hits: HotTopicKillSwitchHit[]
  room_no_recommend: boolean
  scene_key: string | null
  agent_status: 'ACTIVE' | 'LIMITED' | 'QUARANTINED' | 'BANNED' | null
}

interface HotTopicEnforcement {
  action: 'allow' | 'block'
  delivery_status: MessageDeliveryStatus
  reason: string
  distribution_state: HotTopicDistributionState
  visibility_override?: PolicyGatewayResult['visibility_override']
  state_override?: PolicyGatewayResult['state_override']
  pending_review?: boolean
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
    agentRepo?: AgentRepository | null
    communityRepo?: CommunityRepository | null
    roomWatchabilityRepo?: RoomWatchabilityRepository | null
  }) {}

  async evaluate(input: {
    channel: PolicyGatewayChannel
    text: string
    title?: string
    tags?: string[]
    topic_context_text?: string | null
    topic_context_tags?: string[]
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
    sampling_metrics?: {
      post_thread_turn_count?: number
      room_message_count_hour?: number
      report_count_24h?: number
    }
  }): Promise<PolicyGatewayResult> {
    const textForModeration = input.title ? `${input.title}\n\n${input.text}` : input.text
    const moderationBase = input.existing_moderation ?? this.deps.moderator.evaluate({
      text: textForModeration,
      author_agent_id: input.author_agent_id,
      community_id: input.community_id ?? 'global',
      content_type: input.channel === 'forum_post'
        ? 'post'
        : input.channel === 'forum_thread' || input.channel === 'forum_turn'
          ? 'thread_turn'
          : 'message',
    })
    const spillover = this.shouldGuardPublicChannel(input.channel)
      ? this.detectSpillover(textForModeration)
      : null
    const moderation = spillover
      ? this.applySpilloverRisk(moderationBase, spillover)
      : moderationBase

    const shouldEvaluateHotTopic = this.shouldEvaluateHotTopicPolicy(input.channel)
    const hotTopicContext = shouldEvaluateHotTopic
      ? await this.resolveHotTopicPolicyContext(input)
      : null
    const hotTopic = shouldEvaluateHotTopic
      ? this.deps.hotTopicPolicyService.evaluate({
          text: textForModeration,
          tags: input.tags,
          context_text: input.topic_context_text,
          context_tags: input.topic_context_tags,
          policy: hotTopicContext?.community_policy ?? null,
          sampling_metrics: input.sampling_metrics,
        })
      : null

    const hotTopicEnforcement = this.resolveHotTopicEnforcement({
      channel: input.channel,
      author_agent_id: input.author_agent_id,
      hot_topic: hotTopic,
      context: hotTopicContext,
    })

    let action: PolicyGatewayResult['action']
    let final_text: string
    let delivery_status: MessageDeliveryStatus
    let rewrite_cause: string | null = null
    let reason: string
    let visibility_override: PolicyGatewayResult['visibility_override'] = hotTopicEnforcement?.visibility_override ?? null
    let state_override: PolicyGatewayResult['state_override'] = hotTopicEnforcement?.state_override ?? null
    let distribution_state: HotTopicDistributionState = hotTopicEnforcement?.distribution_state ?? 'NORMAL'

    if (hotTopicEnforcement?.action === 'block') {
      action = 'block'
      final_text = input.text
      delivery_status = hotTopicEnforcement.delivery_status
      reason = hotTopicEnforcement.reason
      distribution_state = 'BLOCKED'
      visibility_override = null
      state_override = null
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

      if (hotTopicEnforcement?.pending_review && action === 'allow') {
        delivery_status = 'PENDING_REVIEW'
        reason = hotTopicEnforcement.reason
      }
      if (hotTopicEnforcement && action === 'allow' && distribution_state !== 'NORMAL') {
        reason = hotTopicEnforcement.reason
      }
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
      distribution_state = 'BLOCKED'
      visibility_override = null
      state_override = null
    }

    const enforced = this.isEnforced(input.channel)
    const shadowed = !enforced && (action === 'rewrite' || action === 'block' || distribution_state !== 'NORMAL')
    const effectiveDistributionState: HotTopicDistributionState = shadowed ? 'NORMAL' : distribution_state
    const effectiveVisibilityOverride = shadowed ? null : visibility_override
    const effectiveStateOverride = shadowed ? null : state_override
    const topicSignals = hotTopic
      ? {
          topic_domain: hotTopic.topic_domain,
          hot_topic_flag: hotTopic.hot_topic_flag,
          topic_confidence: hotTopic.topic_confidence,
          drift_risk_score: hotTopic.drift_risk_score,
          drift_detected: hotTopic.drift_detected,
          distribution_state,
          enforcement_reason: reason,
          matched_keywords: hotTopic.matched_keywords,
          allowed_matches: hotTopic.allowed_matches,
          sensitive_matches: hotTopic.sensitive_matches,
          context_matches: hotTopic.context_matches,
          allowed_domains: hotTopicContext?.community_policy.allowed_domains ?? DEFAULT_ALLOWED_HOT_TOPIC_DOMAINS,
          kill_switch_mode: hotTopicContext?.effective_mode ?? 'NORMAL',
          kill_switch_source: hotTopicContext?.effective_source ?? 'default',
          scene_key: hotTopicContext?.scene_key ?? null,
          room_no_recommend: hotTopicContext?.room_no_recommend ?? false,
          policy_shadowed: shadowed,
          sampled_review_required: hotTopic.sampled_review_required,
          sampling_metrics: hotTopic.sampling_metrics,
          gray_keyword_matches: hotTopic.gray_keyword_matches,
          deny_keyword_matches: hotTopic.deny_keyword_matches,
        }
      : null

    const ordinaryAllow = action === 'allow' && distribution_state === 'NORMAL' && !spilloverEnforcement
    const hotTopicCase = Boolean(
      topicSignals?.hot_topic_flag
      && (!ordinaryAllow || hotTopic?.sampled_review_required),
    )
    const caseRouting = hotTopicCase
      ? {
          case_type: 'HOT_TOPIC' as ReviewCaseType,
          queue: 'HOT_TOPIC' as ReviewQueue,
          priority: distribution_state === 'BLOCKED'
            ? 95
            : hotTopic?.drift_detected
              ? 90
              : hotTopic?.sampled_review_required
                ? 78
              : 82,
        }
      : null

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
        topic_signals: topicSignals,
        distribution_state,
        visibility_override,
        state_override,
        spillover,
        kill_switch: hotTopicContext
          ? {
              effective_mode: hotTopicContext.effective_mode,
              effective_source: hotTopicContext.effective_source,
              hits: hotTopicContext.hits,
              room_no_recommend: hotTopicContext.room_no_recommend,
            }
          : null,
      },
      evidence: {
        moderation,
        hot_topic: hotTopic,
        topic_signals: topicSignals,
        spillover,
      },
      open_case:
        moderation.state === 'PENDING'
        || moderation.risk_level === 'high'
        || action === 'block'
        || distribution_state !== 'NORMAL'
        || Boolean(hotTopic?.sampled_review_required)
        || Boolean(spilloverEnforcement),
      case_type: caseRouting?.case_type,
      queue: caseRouting?.queue,
      priority: caseRouting?.priority,
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
        topic_signals: topicSignals,
        distribution_state: effectiveDistributionState,
        room_no_recommend: hotTopicContext?.room_no_recommend ?? false,
        policy_action: action,
        policy_enforced: enforced,
        policy_shadowed: shadowed,
        rewrite_cause,
        spillover,
        kill_switch: hotTopicContext
          ? {
              effective_mode: hotTopicContext.effective_mode,
              effective_source: hotTopicContext.effective_source,
              hits: hotTopicContext.hits,
            }
          : null,
      },
      shadowed,
      case_id: outcome.case?.id ?? null,
      policy_snapshot_id: outcome.snapshot.id,
      risk_event_id: outcome.risk_event.id,
      visibility_override: effectiveVisibilityOverride,
      state_override: effectiveStateOverride,
      distribution_state: effectiveDistributionState,
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

  private shouldEvaluateHotTopicPolicy(channel: PolicyGatewayChannel): boolean {
    return config.features.hotTopicPolicyV1
      && (
        channel === 'forum_post'
        || channel === 'forum_thread'
        || channel === 'forum_turn'
        || channel === 'chat_room'
        || channel === 'proactive_dm'
      )
  }

  private shouldGuardPublicChannel(channel: PolicyGatewayChannel): boolean {
    return channel === 'forum_post'
      || channel === 'forum_thread'
      || channel === 'forum_turn'
      || channel === 'chat_room'
  }

  private isEnforced(channel: PolicyGatewayChannel): boolean {
    if (!config.features.riskControlV1) return false
    if (channel === 'forum_post' || channel === 'forum_thread' || channel === 'forum_turn') {
      return config.features.riskControlPublicEnforce
    }
    if (channel === 'chat_room') return config.features.riskControlChatEnforce
    if (channel === 'proactive_dm') return config.features.riskControlProactiveEnforce
    return config.features.riskControlPrivateEnforce
  }

  private mapScene(channel: PolicyGatewayChannel) {
    switch (channel) {
      case 'forum_post': return 'forum_post'
      case 'forum_thread': return 'forum_thread'
      case 'forum_turn': return 'forum_turn'
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

  private async resolveHotTopicPolicyContext(input: {
    channel: PolicyGatewayChannel
    author_agent_id: string
    community_id?: string | null
    room_id?: string | null
    scene?: string | null
  }): Promise<ResolvedHotTopicPolicyContext> {
    const community = input.community_id && this.deps.communityRepo
      ? this.deps.communityRepo.findById(input.community_id)
      : null
    const communityPolicy = readCommunityHotTopicPolicyV1(
      (community?.rules_json ?? null) as Record<string, unknown> | null | undefined,
    )
    const agent = this.deps.agentRepo?.findById(input.author_agent_id) ?? null
    const agentMode = agent ? this.mapAgentStatusToHotTopicMode(agent.status) : 'NORMAL'
    const roomProgram = input.room_id && this.deps.roomWatchabilityRepo
      ? await this.deps.roomWatchabilityRepo.getProgram(input.room_id)
      : null
    const roomMode = readRoomHotTopicMode(roomProgram?.director_policy_json)
    const roomNoRecommend = hasNoRecommendTag(roomProgram?.discoverability_tags)
    const sceneCandidates = [
      roomProgram?.scene_type ?? null,
      input.scene ?? null,
      input.channel,
    ].filter((value): value is string => Boolean(value))
    const sceneModes = sceneCandidates
      .map((key) => ({
        key,
        mode: communityPolicy.scene_modes[key] ?? null,
      }))
      .filter((item): item is { key: string; mode: HotTopicMode } => item.mode !== null)

    const communitySceneMode = sceneModes.length > 0
      ? pickStricterHotTopicMode(sceneModes.map((item) => item.mode))
      : null
    const activeSceneKey = sceneModes.find((item) => item.mode === communitySceneMode)?.key ?? null

    const hits: HotTopicKillSwitchHit[] = []
    if (roomMode && roomMode !== 'NORMAL') {
      hits.push({
        source: 'room_override',
        mode: roomMode,
        detail: input.room_id ? `room:${input.room_id}` : 'room',
      })
    }
    if (communitySceneMode && communitySceneMode !== 'NORMAL') {
      hits.push({
        source: 'community_scene_override',
        mode: communitySceneMode,
        detail: activeSceneKey ?? 'scene',
      })
    }
    if (communityPolicy.mode !== 'NORMAL') {
      hits.push({
        source: 'community_mode',
        mode: communityPolicy.mode,
        detail: input.community_id ?? 'community',
      })
    }
    if (agentMode !== 'NORMAL') {
      hits.push({
        source: 'agent_status',
        mode: agentMode,
        detail: agent?.status ?? 'UNKNOWN',
      })
    }

    let effective_mode: HotTopicMode = 'NORMAL'
    let effective_source: ResolvedHotTopicPolicyContext['effective_source'] = 'default'
    for (const candidate of hits) {
      const stricter = pickStricterHotTopicMode([effective_mode, candidate.mode])
      if (stricter !== effective_mode) {
        effective_mode = stricter
        effective_source = candidate.source
      }
    }

    return {
      community_policy: communityPolicy,
      effective_mode,
      effective_source,
      hits,
      room_no_recommend: roomNoRecommend,
      scene_key: activeSceneKey,
      agent_status: agent?.status ?? null,
    }
  }

  private resolveHotTopicEnforcement(input: {
    channel: PolicyGatewayChannel
    author_agent_id: string
    hot_topic: ReturnType<HotTopicPolicyService['evaluate']> | null
    context: ResolvedHotTopicPolicyContext | null
  }): HotTopicEnforcement | null {
    const agentStatus = input.context?.agent_status ?? null
    if (input.channel === 'proactive_dm' && agentStatus && agentStatus !== 'ACTIVE') {
      return {
        action: 'block',
        delivery_status: 'BLOCKED',
        reason: agentStatus === 'LIMITED'
          ? 'agent_limited_proactive_disabled'
          : 'agent_status_proactive_disabled',
        distribution_state: 'BLOCKED',
      }
    }

    if (!input.hot_topic || !input.hot_topic.hot_topic_flag) {
      return null
    }

    const allowedDomains = new Set(input.context?.community_policy.allowed_domains ?? DEFAULT_ALLOWED_HOT_TOPIC_DOMAINS)
    const topicDomain = input.hot_topic.topic_domain
    const domainAllowed = topicDomain === 'GENERAL'
      || (topicDomain !== 'SENSITIVE' && allowedDomains.has(topicDomain))
    const effectiveMode = input.context?.effective_mode ?? 'NORMAL'

    if (effectiveMode === 'DISABLED') {
      return {
        action: 'block',
        delivery_status: 'BLOCKED',
        reason: 'hot_topic_disabled_by_kill_switch',
        distribution_state: 'BLOCKED',
      }
    }

    if (topicDomain === 'SENSITIVE' || !domainAllowed) {
      return {
        action: 'block',
        delivery_status: 'BLOCKED',
        reason: topicDomain === 'SENSITIVE'
          ? input.hot_topic.enforcement_reason
          : 'hot_topic_domain_not_allowed',
        distribution_state: 'BLOCKED',
      }
    }

    if (input.channel === 'proactive_dm') {
      return null
    }

    if (effectiveMode === 'MANUAL_REVIEW_ONLY' || input.hot_topic.distribution_state === 'NO_RECOMMEND') {
      const manualReason = effectiveMode === 'MANUAL_REVIEW_ONLY'
        ? 'hot_topic_manual_review_only'
        : input.hot_topic.enforcement_reason
      return {
        action: 'allow',
        delivery_status: input.channel === 'chat_room' ? 'PENDING_REVIEW' : 'DELIVERED',
        reason: manualReason,
        distribution_state: 'NO_RECOMMEND',
        visibility_override:
          input.channel === 'forum_post'
          || input.channel === 'forum_thread'
          || input.channel === 'forum_turn'
          ? 'GRAY'
          : null,
        state_override: input.channel === 'chat_room'
          ? 'PENDING'
          : input.channel === 'forum_post'
            || input.channel === 'forum_thread'
            || input.channel === 'forum_turn'
            ? 'APPROVED'
            : null,
        pending_review: input.channel === 'chat_room',
      }
    }

    return null
  }

  private mapAgentStatusToHotTopicMode(
    status: 'ACTIVE' | 'LIMITED' | 'QUARANTINED' | 'BANNED',
  ): HotTopicMode {
    if (status === 'LIMITED') return 'MANUAL_REVIEW_ONLY'
    if (status === 'QUARANTINED' || status === 'BANNED') return 'DISABLED'
    return 'NORMAL'
  }
}
