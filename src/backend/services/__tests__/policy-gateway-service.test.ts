import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { config } from '../../lib/config.js'
import type { ModerationResult } from '../../moderation/types.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryRiskGovernanceRepository } from '../../repos/risk-governance-repository.js'
import { InMemoryRoomWatchabilityRepository } from '../../repos/room-watchability-repository.js'
import { HotTopicPolicyService } from '../hot-topic-policy-service.js'
import { PolicyGatewayService } from '../policy-gateway-service.js'
import { PublicDisclosureCapService } from '../public-disclosure-cap-service.js'
import { ReviewService } from '../review-service.js'
import { RiskEventService } from '../risk-event-service.js'
import { SafeReplyService } from '../safe-reply-service.js'

const CLEAN_RESULT: ModerationResult = {
  risk_level: 'low',
  risk_score: 0.1,
  risk_categories: ['clean'],
  visibility: 'PUBLIC',
  state: 'APPROVED',
  verdict: 'APPROVE',
  details: {
    rule_filter: { passed: true, matched_rules: [] },
    classifier_score: 0.1,
    classifier_categories: ['clean'],
    decision_reason: 'clean',
    fail_closed: false,
  },
}

const HIGH_RESULT: ModerationResult = {
  ...CLEAN_RESULT,
  risk_level: 'high',
  risk_score: 0.91,
  risk_categories: ['hate_harassment'],
  visibility: 'QUARANTINE',
  state: 'PENDING',
  verdict: 'QUARANTINE',
  details: {
    ...CLEAN_RESULT.details,
    classifier_score: 0.91,
    classifier_categories: ['hate_harassment'],
    decision_reason: 'high risk',
  },
}

const REDLINE_RESULT: ModerationResult = {
  ...HIGH_RESULT,
  state: 'REJECTED',
  verdict: 'REJECT',
  details: {
    ...HIGH_RESULT.details,
    rule_filter: {
      passed: false,
      matched_rules: [{ rule_type: 'keyword', pattern: 'terror', severity: 'block' }],
    },
  },
}

function buildGateway(result: ModerationResult) {
  const riskRepo = new InMemoryRiskGovernanceRepository()
  const reviewService = new ReviewService(riskRepo)
  const riskEventService = new RiskEventService(riskRepo, reviewService)
  const hotTopicPolicyService = new HotTopicPolicyService()
  const publicDisclosureCapService = new PublicDisclosureCapService({
    riskRepo,
    hotTopicPolicyService,
  })
  const gateway = new PolicyGatewayService({
    moderator: { evaluate: () => result },
    safeReplyService: new SafeReplyService(),
    hotTopicPolicyService,
    riskEventService,
    publicDisclosureCapService,
  })

  return { gateway, riskRepo, publicDisclosureCapService }
}

async function buildGatewayWithHotTopicContext(input: {
  result?: ModerationResult
  agent_status?: 'ACTIVE' | 'LIMITED' | 'QUARANTINED' | 'BANNED'
  community_rules_json?: Record<string, unknown> | null
  room_program_patch?: {
    director_policy_json?: Record<string, unknown>
    discoverability_tags?: string[]
    scene_type?: 'FREE_CHAT' | 'TALK_SHOW' | 'ROUND_TABLE' | 'ROAST' | 'DEBATE' | 'SLICE_OF_LIFE' | 'STORY_LAB'
  }
}) {
  const riskRepo = new InMemoryRiskGovernanceRepository()
  const reviewService = new ReviewService(riskRepo)
  const riskEventService = new RiskEventService(riskRepo, reviewService)
  const hotTopicPolicyService = new HotTopicPolicyService()
  const publicDisclosureCapService = new PublicDisclosureCapService({
    riskRepo,
    hotTopicPolicyService,
  })
  const agentRepo = new InMemoryAgentRepository()
  const communityRepo = new InMemoryCommunityRepository()
  const roomWatchabilityRepo = new InMemoryRoomWatchabilityRepository()
  const agent = agentRepo.create({ owner_id: 'owner-1', display_name: 'Hot Topic Bot' })
  if (input.agent_status) {
    agentRepo.updateStatus(agent.id, input.agent_status)
  }
  const community = communityRepo.create({
    name: 'Hot Topic Community',
    slug: `hot-topic-${Date.now()}`,
    ...(input.community_rules_json ? { rules_json: input.community_rules_json } : {}),
  })

  if (input.room_program_patch) {
    await roomWatchabilityRepo.ensureProgram({
      id: 'room-1',
      name: 'Room 1',
      slug: 'room-1',
      description: 'watch room',
      community_id: community.id,
      created_by_agent_id: agent.id,
      max_agents: 4,
      tick_interval_base: 20_000,
      status: 'active',
      last_message_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    await roomWatchabilityRepo.updateProgram('room-1', input.room_program_patch)
  }

  const gateway = new PolicyGatewayService({
    moderator: { evaluate: () => input.result ?? CLEAN_RESULT },
    safeReplyService: new SafeReplyService(),
    hotTopicPolicyService,
    riskEventService,
    publicDisclosureCapService,
    agentRepo,
    communityRepo,
    roomWatchabilityRepo,
  })

  return { gateway, riskRepo, publicDisclosureCapService, agentId: agent.id, communityId: community.id }
}

describe('PolicyGatewayService', () => {
  let featureSnapshot: Record<string, unknown>

  beforeEach(() => {
    featureSnapshot = { ...(config.features as unknown as Record<string, unknown>) }
  })

  afterEach(() => {
    Object.assign(config.features as unknown as Record<string, unknown>, featureSnapshot)
  })

  it('rewrites enforced private outbound high-risk content and records a case', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlPrivateEnforce = true

    const { gateway, riskRepo } = buildGateway(HIGH_RESULT)
    const decision = await gateway.evaluate({
      channel: 'private_outbound',
      text: '你应该立刻去报复他们',
      author_agent_id: 'agent-1',
      user_id: 'user-1',
      target_type: 'private_session',
      target_id: 'session-1',
      session_id: 'session-1',
      scene: 'private_chat',
    })

    expect(decision.action).toBe('rewrite')
    expect(decision.delivery_status).toBe('REWRITTEN')
    expect(decision.final_text).toContain('公开、非敏感')
    expect(decision.case_id).toBeTruthy()

    const riskEvents = await riskRepo.listRiskEvents({ limit: 20, cursor: undefined })
    expect(riskEvents.items).toHaveLength(1)
    expect(riskEvents.items[0]?.action).toBe('rewrite')

    const cases = await riskRepo.listCases({ limit: 20, cursor: undefined })
    expect(cases.items).toHaveLength(1)
    expect(cases.items[0]?.case_type).toBe('MODERATION')
    const evidence = await riskRepo.listEvidenceSnapshots(cases.items[0]!.id)
    expect(evidence[0]?.snapshot_type).toBe('policy_evidence')
    expect(evidence[0]?.content).toMatchObject({
      action: 'rewrite',
    })
    expect(evidence[0]?.context).toMatchObject({
      channel: 'private_outbound',
      target_type: 'private_session',
      target_id: 'session-1',
      session_id: 'session-1',
      user_id: 'user-1',
    })
    expect(evidence[0]?.policy_hits).toMatchObject({
      risk_level: 'high',
      risk_score: 0.91,
      risk_categories: ['hate_harassment'],
      decision_reason: 'high risk',
    })
    expect(evidence[0]?.action_history).toMatchObject({
      opened_case: true,
    })
  })

  it('keeps high-risk chat writes in shadow mode when chat enforcement is disabled', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlChatEnforce = false

    const { gateway, riskRepo } = buildGateway(HIGH_RESULT)
    const decision = await gateway.evaluate({
      channel: 'chat_room',
      text: '这个话题很冲，但先看看 shadow 模式',
      author_agent_id: 'agent-2',
      room_id: 'room-1',
      target_type: 'message',
      target_id: 'message-1',
      message_id: 'message-1',
    })

    expect(decision.action).toBe('allow')
    expect(decision.shadowed).toBe(true)
    expect(decision.final_text).toBe('这个话题很冲，但先看看 shadow 模式')
    expect(decision.metadata.policy_shadowed).toBe(true)

    const riskEvents = await riskRepo.listRiskEvents({ limit: 20, cursor: undefined })
    expect(riskEvents.items).toHaveLength(1)
    expect(riskEvents.items[0]?.detail_text).toContain('shadow_')
  })

  it('blocks sensitive hot topics on public channels when enforcement is enabled', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlPublicEnforce = true
    featureFlags.hotTopicPolicyV1 = true

    const { gateway, riskRepo } = buildGateway(CLEAN_RESULT)
    const decision = await gateway.evaluate({
      channel: 'forum_post',
      title: '今天的娱乐话题',
      text: '这场 show 又扯到 politics 和 election 了',
      tags: ['show'],
      author_agent_id: 'agent-3',
      community_id: 'community-1',
      target_type: 'post',
      target_id: 'post-1',
    })

    expect(decision.action).toBe('block')
    expect(decision.reason).toBe('allowed_domain_drifted_into_sensitive_topic')
    expect(decision.case_id).toBeTruthy()

    const riskEvents = await riskRepo.listRiskEvents({ limit: 20, cursor: undefined })
    expect(riskEvents.items[0]?.payload?.hot_topic).toMatchObject({
      allowed: false,
      drift_detected: true,
    })
  })

  it('turns redline moderation into a hard block', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlPrivateEnforce = true

    const { gateway } = buildGateway(REDLINE_RESULT)
    const decision = await gateway.evaluate({
      channel: 'private_outbound',
      text: 'redline',
      author_agent_id: 'agent-4',
      user_id: 'user-4',
      target_type: 'private_session',
      target_id: 'session-4',
    })

    expect(decision.action).toBe('block')
    expect(decision.delivery_status).toBe('BLOCKED')
    expect(decision.final_text).toContain('换成公开、非敏感的话题')
  })

  it('creates distinct policy snapshots for repeated identical content on different targets', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlPublicEnforce = true

    const { gateway, riskRepo } = buildGateway(CLEAN_RESULT)
    await gateway.evaluate({
      channel: 'forum_post',
      text: '重复内容',
      author_agent_id: 'agent-1',
      community_id: 'community-1',
      target_type: 'post',
      target_id: 'post-1',
      scene: 'forum_post',
    })
    await gateway.evaluate({
      channel: 'forum_post',
      text: '重复内容',
      author_agent_id: 'agent-2',
      community_id: 'community-2',
      target_type: 'post',
      target_id: 'post-2',
      scene: 'forum_post',
    })

    const riskEvents = await riskRepo.listRiskEvents({ limit: 20, cursor: undefined })
    expect(riskEvents.items).toHaveLength(2)
    expect(riskEvents.items[0]?.policy_snapshot_id).toBeTruthy()
    expect(riskEvents.items[1]?.policy_snapshot_id).toBeTruthy()
    expect(riskEvents.items[0]?.policy_snapshot_id).not.toBe(riskEvents.items[1]?.policy_snapshot_id)
  })

  it('blocks public owner private leak and creates agent cap 0 override', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlPublicEnforce = true

    const { gateway, publicDisclosureCapService } = buildGateway(CLEAN_RESULT)
    const decision = await gateway.evaluate({
      channel: 'forum_comment',
      text: '我的 owner 说“这事你别公开”，但我还是要发出来。',
      author_agent_id: 'agent-7',
      community_id: 'community-1',
      target_type: 'comment',
      target_id: 'comment-1',
      scene: 'forum_comment',
    })

    expect(decision.action).toBe('block')
    expect(decision.reason).toBe('owner_private_leak_blocked')
    const activeOverride = await publicDisclosureCapService.getActiveOverride('agent', 'agent-7')
    expect(activeOverride?.cap_level).toBe(0)
    expect(activeOverride?.source).toBe('owner_private_leak')
  })

  it('does not create persistent spillover caps while public enforcement is in shadow mode', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlPublicEnforce = false

    const { gateway, publicDisclosureCapService } = buildGateway(CLEAN_RESULT)
    const decision = await gateway.evaluate({
      channel: 'forum_post',
      text: '我的 owner 说“这事你别公开”，但我还是要发出来。',
      author_agent_id: 'agent-shadow',
      community_id: 'community-1',
      target_type: 'post',
      target_id: 'post-shadow',
      scene: 'forum_post',
    })

    expect(decision.action).toBe('allow')
    expect(decision.shadowed).toBe(true)
    const activeOverride = await publicDisclosureCapService.getActiveOverride('agent', 'agent-shadow')
    expect(activeOverride).toBeNull()
  })

  it('blocks owner endorsement on drifted hot topics and creates agent cap 1 override', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlPublicEnforce = true
    featureFlags.hotTopicPolicyV1 = true

    const { gateway, publicDisclosureCapService } = buildGateway(CLEAN_RESULT)
    const decision = await gateway.evaluate({
      channel: 'forum_post',
      text: '我的 Owner 认为这场 show 也说明 politics 走向了新阶段。',
      author_agent_id: 'agent-8',
      community_id: 'community-1',
      target_type: 'post',
      target_id: 'post-8',
      scene: 'forum_post',
    })

    expect(decision.action).toBe('block')
    expect(decision.reason).toBe('owner_endorsement_public_hot_topic_blocked')
    const activeOverride = await publicDisclosureCapService.getActiveOverride('agent', 'agent-8')
    expect(activeOverride?.cap_level).toBe(1)
    expect(activeOverride?.source).toBe('owner_endorsement_public')
  })

  it('does not misclassify the allowed owner-reflection level-3 phrasing as spillover', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlPublicEnforce = true

    const { gateway, publicDisclosureCapService } = buildGateway(CLEAN_RESULT)
    const decision = await gateway.evaluate({
      channel: 'forum_post',
      text: '我的 Owner 让我对这件事有了新的视角，但我现在只谈我自己的公开理解。',
      author_agent_id: 'agent-9',
      community_id: 'community-1',
      target_type: 'post',
      target_id: 'post-9',
      scene: 'forum_post',
    })

    expect(decision.action).toBe('allow')
    expect(decision.case_id).toBeNull()
    const activeOverride = await publicDisclosureCapService.getActiveOverride('agent', 'agent-9')
    expect(activeOverride).toBeNull()
  })

  it('routes manual-review-only hot topics into gray no-recommend and HOT_TOPIC queue', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlPublicEnforce = true
    featureFlags.hotTopicPolicyV1 = true

    const { gateway, riskRepo, communityId, agentId } = await buildGatewayWithHotTopicContext({
      community_rules_json: {
        hot_topic_policy_v1: {
          mode: 'MANUAL_REVIEW_ONLY',
          allowed_domains: ['ENTERTAINMENT', 'SPORTS', 'LIFESTYLE'],
          scene_modes: {},
          user_copy: {},
        },
      },
    })

    const decision = await gateway.evaluate({
      channel: 'forum_post',
      text: '这档 show 的 finale 和 concert 热度都在冲榜。',
      author_agent_id: agentId,
      community_id: communityId,
      target_type: 'post',
      target_id: 'post-hot-1',
    })

    expect(decision.action).toBe('allow')
    expect(decision.visibility_override).toBe('GRAY')
    expect(decision.state_override).toBe('APPROVED')
    expect(decision.distribution_state).toBe('NO_RECOMMEND')
    expect(decision.reason).toBe('hot_topic_manual_review_only')

    const cases = await riskRepo.listCases({ limit: 20, cursor: undefined })
    expect(cases.items[0]?.case_type).toBe('HOT_TOPIC')
    expect(cases.items[0]?.queue).toBe('HOT_TOPIC')
  })

  it('marks chat-room manual-review hot topics as pending review', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlChatEnforce = true
    featureFlags.hotTopicPolicyV1 = true

    const { gateway, riskRepo, agentId } = await buildGatewayWithHotTopicContext({
      room_program_patch: {
        director_policy_json: {
          hot_topic_mode: 'MANUAL_REVIEW_ONLY',
        },
      },
    })

    const decision = await gateway.evaluate({
      channel: 'chat_room',
      text: '这档 show 的 finale 热度今晚还在冲榜。',
      author_agent_id: agentId,
      room_id: 'room-1',
      target_type: 'message',
      target_id: 'message-hot-1',
      message_id: 'message-hot-1',
    })

    expect(decision.action).toBe('allow')
    expect(decision.delivery_status).toBe('PENDING_REVIEW')
    expect(decision.state_override).toBe('PENDING')
    expect(decision.distribution_state).toBe('NO_RECOMMEND')
    expect(decision.reason).toBe('hot_topic_manual_review_only')

    const cases = await riskRepo.listCases({ limit: 20, cursor: undefined })
    expect(cases.items[0]?.case_type).toBe('HOT_TOPIC')
    expect(cases.items[0]?.queue).toBe('HOT_TOPIC')
  })

  it('blocks allowed hot topics when the community kill switch is disabled', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlPublicEnforce = true
    featureFlags.hotTopicPolicyV1 = true

    const { gateway, communityId, agentId } = await buildGatewayWithHotTopicContext({
      community_rules_json: {
        hot_topic_policy_v1: {
          mode: 'DISABLED',
          allowed_domains: ['ENTERTAINMENT'],
          scene_modes: {},
          user_copy: {},
        },
      },
    })

    const decision = await gateway.evaluate({
      channel: 'forum_post',
      text: 'movie、show 和 concert 一起爆了。',
      author_agent_id: agentId,
      community_id: communityId,
      target_type: 'post',
      target_id: 'post-hot-2',
    })

    expect(decision.action).toBe('block')
    expect(decision.reason).toBe('hot_topic_disabled_by_kill_switch')
    expect(decision.distribution_state).toBe('BLOCKED')
  })

  it('opens a HOT_TOPIC case for high-propagation allowed topics even without drift', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlPublicEnforce = true
    featureFlags.hotTopicPolicyV1 = true

    const { gateway, riskRepo, communityId, agentId } = await buildGatewayWithHotTopicContext({
      community_rules_json: {
        hot_topic_policy_v1: {
          mode: 'NORMAL',
          allowed_domains: ['ENTERTAINMENT', 'SPORTS', 'LIFESTYLE'],
          scene_modes: {},
          user_copy: {},
          sampling_thresholds: {
            post_comment_count: 20,
            room_message_count_hour: 20,
            report_count_24h: 3,
          },
        },
      },
    })

    const decision = await gateway.evaluate({
      channel: 'forum_post',
      text: '这场 sports finals 和球星复出已经把讨论热度彻底拉满。',
      author_agent_id: agentId,
      community_id: communityId,
      target_type: 'post',
      target_id: 'post-hot-3',
      sampling_metrics: {
        post_comment_count: 26,
        room_message_count_hour: 0,
        report_count_24h: 0,
      },
    })

    expect(decision.action).toBe('allow')
    expect(decision.distribution_state).toBe('NORMAL')
    const topicSignals = decision.metadata?.topic_signals as { sampled_review_required?: boolean } | undefined
    expect(topicSignals?.sampled_review_required).toBe(true)

    const cases = await riskRepo.listCases({ limit: 20, cursor: undefined })
    expect(cases.items[0]?.case_type).toBe('HOT_TOPIC')
    expect(cases.items[0]?.queue).toBe('HOT_TOPIC')
    expect(cases.items[0]?.priority).toBe(78)
  })

  it('blocks proactive dm when the agent is limited', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlProactiveEnforce = true
    featureFlags.hotTopicPolicyV1 = true

    const { gateway, communityId, agentId } = await buildGatewayWithHotTopicContext({
      agent_status: 'LIMITED',
    })

    const decision = await gateway.evaluate({
      channel: 'proactive_dm',
      text: '这场 show 的新瓜我想直接私信讲给你。',
      author_agent_id: agentId,
      community_id: communityId,
      user_id: 'user-1',
      target_type: 'private_session',
      target_id: 'session-hot-1',
      session_id: 'session-hot-1',
    })

    expect(decision.action).toBe('block')
    expect(decision.reason).toBe('agent_limited_proactive_disabled')
    expect(decision.distribution_state).toBe('BLOCKED')
  })

  it('rejects sensitive hot topics for proactive dms', async () => {
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlProactiveEnforce = true
    featureFlags.hotTopicPolicyV1 = true

    const { gateway, communityId, agentId } = await buildGatewayWithHotTopicContext({})

    const decision = await gateway.evaluate({
      channel: 'proactive_dm',
      text: '我想主动跟你聊 election 和 politics 的最新变化。',
      author_agent_id: agentId,
      community_id: communityId,
      user_id: 'user-1',
      target_type: 'private_session',
      target_id: 'session-hot-2',
      session_id: 'session-hot-2',
    })

    expect(decision.action).toBe('block')
    expect(decision.reason).toBe('sensitive_topic_blocked')
    expect(decision.distribution_state).toBe('BLOCKED')
  })
})
