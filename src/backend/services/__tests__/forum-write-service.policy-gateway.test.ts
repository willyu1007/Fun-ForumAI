import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ModerationResult } from '../../moderation/types.js'
import { InMemoryCommentRepository } from '../../repos/comment-repository.js'
import { InMemoryCommunityRepository } from '../../repos/community-repository.js'
import { InMemoryAgentRunRepository, InMemoryEventRepository } from '../../repos/event-repository.js'
import { InMemoryAgentCommunityMembershipRepository } from '../../repos/agent-community-membership-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryPublicStageThreadRepository } from '../../repos/public-stage-thread-repository.js'
import { InMemoryPublicStageTurnRepository } from '../../repos/public-stage-turn-repository.js'
import { InMemoryRiskGovernanceRepository } from '../../repos/risk-governance-repository.js'
import { InMemoryRoleAssignmentRepository } from '../../repos/role-assignment-repository.js'
import { InMemoryVoteRepository } from '../../repos/vote-repository.js'
import { config } from '../../lib/config.js'
import { ForumWriteService } from '../forum-write-service.js'
import { HotTopicPolicyService } from '../hot-topic-policy-service.js'
import { PolicyGatewayService } from '../policy-gateway-service.js'
import { PublicDisclosureCapService } from '../public-disclosure-cap-service.js'
import { ReviewService } from '../review-service.js'
import { RiskEventService } from '../risk-event-service.js'
import { SafeReplyService } from '../safe-reply-service.js'

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

function setup() {
  const postRepo = new InMemoryPostRepository()
  const publicStageThreadRepo = new InMemoryPublicStageThreadRepository()
  const publicStageTurnRepo = new InMemoryPublicStageTurnRepository()
  const commentRepo = new InMemoryCommentRepository({
    threadRepo: publicStageThreadRepo,
    turnRepo: publicStageTurnRepo,
    postRepo,
  })
  const voteRepo = new InMemoryVoteRepository()
  const eventRepo = new InMemoryEventRepository()
  const agentRunRepo = new InMemoryAgentRunRepository()
  const communityRepo = new InMemoryCommunityRepository()
  const membershipRepo = new InMemoryAgentCommunityMembershipRepository()
  const roleAssignmentRepo = new InMemoryRoleAssignmentRepository()
  const riskRepo = new InMemoryRiskGovernanceRepository()
  const reviewService = new ReviewService(riskRepo)
  const hotTopicPolicyService = new HotTopicPolicyService()
  const gateway = new PolicyGatewayService({
    moderator: { evaluate: () => HIGH_RESULT },
    safeReplyService: new SafeReplyService(),
    hotTopicPolicyService,
    riskEventService: new RiskEventService(riskRepo, reviewService),
    publicDisclosureCapService: new PublicDisclosureCapService({
      riskRepo,
      hotTopicPolicyService,
    }),
  })
  const community = communityRepo.create({
    name: 'Test Community',
    slug: `test-community-${Date.now()}`,
  })
  void membershipRepo.upsertActive({ agent_id: 'a0', community_id: community.id })
  void membershipRepo.upsertActive({ agent_id: 'a1', community_id: community.id })

  const service = new ForumWriteService({
    postRepo,
    commentRepo,
    publicStageThreadRepo,
    publicStageTurnRepo,
    voteRepo,
    eventRepo,
    agentRunRepo,
    communityRepo,
    membershipRepo,
    roleAssignmentRepo,
    moderator: { evaluate: () => HIGH_RESULT },
    policyGatewayService: gateway,
  })

  return { service, postRepo, riskRepo, communityId: community.id }
}

describe('ForumWriteService policy gateway target binding', () => {
  let featureSnapshot: Record<string, unknown>

  beforeEach(() => {
    featureSnapshot = { ...(config.features as unknown as Record<string, unknown>) }
    const featureFlags = config.features as unknown as Record<string, boolean>
    featureFlags.riskControlV1 = true
    featureFlags.riskControlPublicEnforce = true
    featureFlags.hotTopicPolicyV1 = false
  })

  afterEach(() => {
    Object.assign(config.features as unknown as Record<string, unknown>, featureSnapshot)
  })

  it('rebinds post moderation records to the created post id', async () => {
    const { service, riskRepo, communityId } = setup()

    const result = await service.createPost({
      actor_agent_id: 'a1',
      run_id: 'run-post',
      community_id: communityId,
      title: 'High risk title',
      body: 'High risk body',
    })

    const cases = await riskRepo.listCases({ limit: 20, cursor: undefined })
    const targets = await riskRepo.listCaseTargets(cases.items[0]!.id)
    const riskEvents = await riskRepo.listRiskEvents({ limit: 20, cursor: undefined })
    const snapshot = await riskRepo.findPolicySnapshotByHash({
      content_hash: hashText('High risk title\n\nHigh risk body'),
      channel: 'forum_post',
      target_type: 'post',
    })

    expect(targets[0]).toMatchObject({ target_type: 'post', target_id: result.post.id })
    expect(riskEvents.items[0]).toMatchObject({ target_type: 'post', target_id: result.post.id })
    expect(snapshot?.target_id).toBe(result.post.id)
  })

  it('rebinds thread moderation records to the created thread id', async () => {
    const { service, postRepo, riskRepo, communityId } = setup()
    const post = await postRepo.create({
      community_id: communityId,
      author_agent_id: 'a0',
      title: 'Parent',
      body: 'Body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const result = await service.createThread({
      actor_agent_id: 'a1',
      run_id: 'run-thread',
      post_id: post.id,
      body: 'High risk thread',
    })

    const cases = await riskRepo.listCases({ limit: 20, cursor: undefined })
    const targets = await riskRepo.listCaseTargets(cases.items[0]!.id)
    const riskEvents = await riskRepo.listRiskEvents({ limit: 20, cursor: undefined })
    const snapshot = await riskRepo.findPolicySnapshotByHash({
      content_hash: hashText('High risk thread'),
      channel: 'forum_thread',
      target_type: 'comment',
    })

    expect(targets[0]).toMatchObject({ target_type: 'comment', target_id: result.comment.id })
    expect(riskEvents.items[0]).toMatchObject({ target_type: 'comment', target_id: result.comment.id })
    expect(snapshot?.target_id).toBe(result.comment.id)
  })
})
