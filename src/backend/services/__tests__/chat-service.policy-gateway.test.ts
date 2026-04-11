import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ModerationResult } from '../../moderation/types.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryEventRepository } from '../../repos/event-repository.js'
import { InMemoryMediaContextProjectionRepository } from '../../repos/media-context-projection-repository.js'
import { InMemoryMessageRepository } from '../../repos/message-repository.js'
import { InMemoryRiskGovernanceRepository } from '../../repos/risk-governance-repository.js'
import { InMemoryRoomRepository } from '../../repos/room-repository.js'
import { InMemorySceneMediaBindingRepository } from '../../repos/scene-media-binding-repository.js'
import { InMemoryRoomWatchabilityRepository } from '../../repos/room-watchability-repository.js'
import { config } from '../../lib/config.js'
import { ChatService } from '../chat-service.js'
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
  risk_level: 'high',
  risk_score: 0.91,
  risk_categories: ['hate_harassment'],
  visibility: 'GRAY',
  state: 'PENDING',
  verdict: 'FOLD',
  details: {
    rule_filter: { passed: true, matched_rules: [] },
    classifier_score: 0.91,
    classifier_categories: ['hate_harassment'],
    decision_reason: 'high risk',
    fail_closed: false,
  },
}

function hashText(value: string): string {
  return createHash('sha256').update(value.trim()).digest('hex')
}

function setup(options: {
  moderationResult?: ModerationResult
  withRoomWatchability?: boolean
} = {}) {
  const roomRepo = new InMemoryRoomRepository()
  const messageRepo = new InMemoryMessageRepository()
  const agentRepo = new InMemoryAgentRepository()
  const eventRepo = new InMemoryEventRepository()
  const riskRepo = new InMemoryRiskGovernanceRepository()
  const reviewService = new ReviewService(riskRepo)
  const hotTopicPolicyService = new HotTopicPolicyService()
  const roomWatchabilityRepo = options.withRoomWatchability
    ? new InMemoryRoomWatchabilityRepository()
    : null
  const publicDisclosureCapService = new PublicDisclosureCapService({
    riskRepo,
    hotTopicPolicyService,
  })
  const policyGatewayService = new PolicyGatewayService({
    moderator: { evaluate: () => options.moderationResult ?? HIGH_RESULT },
    safeReplyService: new SafeReplyService(),
    hotTopicPolicyService,
    riskEventService: new RiskEventService(riskRepo, reviewService),
    publicDisclosureCapService,
    agentRepo,
    roomWatchabilityRepo,
  })

  const author = agentRepo.create({ owner_id: 'owner-1', display_name: 'Chatter' })

  const service = new ChatService({
    roomRepo,
    messageRepo,
    agentRepo,
    agentService: { getLatestConfig: () => null } as never,
    eventRepo,
    policyGatewayService,
    roomWatchabilityRepo,
    sceneMediaBindingRepo: new InMemorySceneMediaBindingRepository(),
    mediaContextProjectionRepo: new InMemoryMediaContextProjectionRepository(),
  })

  return { service, roomRepo, messageRepo, riskRepo, roomWatchabilityRepo, authorId: author.id }
}

describe('ChatService policy gateway target binding', () => {
  let featureSnapshot: Record<string, unknown>

  beforeEach(() => {
    featureSnapshot = { ...(config.launch.capabilities as unknown as Record<string, unknown>) }
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlChatEnforce = true
    featureFlags.hotTopicPolicyV1 = false
  })

  afterEach(() => {
    Object.assign(config.launch.capabilities as unknown as Record<string, unknown>, featureSnapshot)
  })

  it('rebinds message moderation records to the created chat message id', async () => {
    const { service, roomRepo, riskRepo, authorId } = setup()
    const room = await roomRepo.create({
      name: 'Risk Room',
      slug: `risk-room-${Date.now()}`,
      description: 'Room',
      created_by_agent_id: authorId,
    })
    await roomRepo.addMember(room.id, authorId, 'creator', 10_000)

    const result = await service.sendMessage({
      room_id: room.id,
      author_id: authorId,
      body: 'High risk room message',
    })

    const cases = await riskRepo.listCases({ limit: 20, cursor: undefined })
    const targets = await riskRepo.listCaseTargets(cases.items[0]!.id)
    const riskEvents = await riskRepo.listRiskEvents({ limit: 20, cursor: undefined })
    const snapshot = await riskRepo.findPolicySnapshotByHash({
      content_hash: hashText('High risk room message'),
      channel: 'chat_room',
      target_type: 'message',
    })

    expect(targets[0]).toMatchObject({
      target_type: 'message',
      target_id: result.id,
      room_id: room.id,
      message_id: result.id,
    })
    expect(riskEvents.items[0]).toMatchObject({
      target_type: 'message',
      target_id: result.id,
      room_id: room.id,
      message_id: result.id,
    })
    expect(snapshot?.target_id).toBe(result.id)
  })

  it('persists manual-review-only hot topic room messages as pending', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    featureFlags.hotTopicPolicyV1 = true

    const { service, roomRepo, messageRepo, roomWatchabilityRepo, authorId } = setup({
      moderationResult: CLEAN_RESULT,
      withRoomWatchability: true,
    })
    const room = await roomRepo.create({
      name: 'Hot Topic Review Room',
      slug: `hot-topic-review-room-${Date.now()}`,
      description: 'Room',
      created_by_agent_id: authorId,
    })
    await roomRepo.addMember(room.id, authorId, 'creator', 10_000)
    await roomWatchabilityRepo!.ensureProgram(room)
    await roomWatchabilityRepo!.updateProgram(room.id, {
      director_policy_json: {
        hot_topic_mode: 'MANUAL_REVIEW_ONLY',
      },
    })

    const result = await service.sendMessage({
      room_id: room.id,
      author_id: authorId,
      body: '今晚这场 show 的 finale 还在冲榜。',
    })
    const stored = await messageRepo.findById(result.id)

    expect(result.state).toBe('PENDING')
    expect(stored?.state).toBe('PENDING')
    expect(stored?.moderation_metadata).toMatchObject({
      topic_signals: {
        distribution_state: 'NO_RECOMMEND',
      },
    })
  })
})
