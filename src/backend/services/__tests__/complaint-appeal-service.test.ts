import { describe, expect, it } from 'vitest'
import {
  InMemoryAgentRepository,
  InMemoryCommentRepository,
  InMemoryMessageRepository,
  InMemoryPostRepository,
} from '../../repos/index.js'
import { InMemoryRiskGovernanceRepository } from '../../repos/risk-governance-repository.js'
import { ComplaintAppealService } from '../complaint-appeal-service.js'
import { ReviewService } from '../review-service.js'

function setup() {
  const riskRepo = new InMemoryRiskGovernanceRepository()
  const reviewService = new ReviewService(riskRepo)
  const agentRepo = new InMemoryAgentRepository()
  const postRepo = new InMemoryPostRepository()
  const commentRepo = new InMemoryCommentRepository()
  const messageRepo = new InMemoryMessageRepository()
  const agent = agentRepo.create({ owner_id: 'owner-1', display_name: 'Review Bot' })
  const service = new ComplaintAppealService(riskRepo, reviewService, {
    postRepo,
    commentRepo,
    messageRepo,
    agentRepo,
  })
  return { riskRepo, reviewService, service, agent, postRepo, commentRepo, messageRepo }
}

describe('ComplaintAppealService', () => {
  it('opens and links a complaint case on first report', async () => {
    const { riskRepo, service, agent, messageRepo } = setup()
    const message = await messageRepo.create({
      room_id: 'room-1',
      author_id: agent.id,
      body: 'hello world',
    })

    const result = await service.createReport({
      reporter_user_id: 'user-1',
      target_type: 'message',
      target_id: message.id,
      reason_code: 'abuse',
      detail_text: 'contains harassment',
    })

    expect(result.case?.case_type).toBe('COMPLAINT')
    expect(result.complaint?.status).toBe('LINKED')
    expect(result.complaint?.linked_case_id).toBe(result.case?.id ?? null)

    const cases = await riskRepo.listCases({ limit: 20, cursor: undefined })
    expect(cases.items).toHaveLength(1)
    const targets = await riskRepo.listCaseTargets(cases.items[0]!.id)
    expect(targets[0]).toMatchObject({ target_type: 'message', target_id: message.id })
  })

  it('reopens an existing case instead of creating a duplicate complaint case', async () => {
    const { riskRepo, service, reviewService, agent, messageRepo } = setup()
    const message = await messageRepo.create({
      room_id: 'room-2',
      author_id: agent.id,
      body: 'duplicate target',
    })
    const original = await reviewService.openAutomatedCase({
      case_type: 'COMPLAINT',
      summary_text: 'Existing complaint case',
      opened_reason: 'seeded',
      target: {
        case_id: '',
        target_type: 'message',
        target_id: message.id,
        channel: 'report',
      },
    })
    await reviewService.resolveCase(original.id, 'seeded_resolution')

    const result = await service.createReport({
      reporter_user_id: 'user-2',
      target_type: 'message',
      target_id: message.id,
      reason_code: 'repeat_report',
    })

    expect(result.case?.id).toBe(original.id)
    expect(result.case?.status).toBe('OPEN')

    const cases = await riskRepo.listCases({ limit: 20, cursor: undefined })
    expect(cases.items).toHaveLength(1)
    const evidence = await riskRepo.listEvidenceSnapshots(original.id)
    expect(evidence.some((item) => item.snapshot_type === 'case_reopened')).toBe(true)
  })

  it('links appeal requests into their own review case', async () => {
    const { riskRepo, service, agent, postRepo } = setup()
    const post = await postRepo.create({
      community_id: 'community-1',
      author_agent_id: agent.id,
      title: 'Appealable post',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const result = await service.createAppeal({
      requester_user_id: 'user-3',
      target_type: 'post',
      target_id: post.id,
      reason: 'this should be reviewed again',
    })

    expect(result.appeal?.status).toBe('LINKED')
    expect(result.case?.case_type).toBe('APPEAL')
    expect(result.appeal?.linked_case_id).toBe(result.case?.id ?? null)

    const appeals = await riskRepo.listAppealRequests({ limit: 20, cursor: undefined })
    expect(appeals.items).toHaveLength(1)
  })

  it('rejects non-reportable target types', async () => {
    const { service } = setup()

    await expect(service.createReport({
      reporter_user_id: 'user-1',
      target_type: 'unsupported_target',
      target_id: 'x-1',
      reason_code: 'spam',
    })).rejects.toThrow('target_type must be one of')
  })

  it('rejects missing targets before creating complaint or appeal cases', async () => {
    const { service } = setup()

    await expect(service.createReport({
      reporter_user_id: 'user-1',
      target_type: 'post',
      target_id: 'missing-post',
      reason_code: 'spam',
    })).rejects.toThrow('Post')

    await expect(service.createAppeal({
      requester_user_id: 'user-1',
      target_type: 'agent',
      target_id: 'missing-agent',
      reason: 'please review',
    })).rejects.toThrow('Agent')
  })
})
