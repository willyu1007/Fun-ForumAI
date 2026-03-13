import { describe, expect, it, vi } from 'vitest'
import {
  InMemoryAgentRepository,
  InMemoryCommentRepository,
  InMemoryMessageRepository,
  InMemoryNotificationRepository,
  InMemoryPostRepository,
} from '../../repos/index.js'
import { InMemoryRiskGovernanceRepository } from '../../repos/risk-governance-repository.js'
import { ComplaintAppealService } from '../complaint-appeal-service.js'
import { NotificationService } from '../notification-service.js'
import { ReviewService } from '../review-service.js'

function setup(input?: {
  privateSessionLookup?: (sessionId: string) => Promise<{ id: string; human_user_id: string } | null>
}) {
  const riskRepo = new InMemoryRiskGovernanceRepository()
  const notificationService = new NotificationService(new InMemoryNotificationRepository())
  const reviewService = new ReviewService(riskRepo, notificationService)
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
  }, notificationService)
  service.setPrivateSessionLookup(input?.privateSessionLookup ?? null)
  return { riskRepo, reviewService, service, agent, postRepo, commentRepo, messageRepo, notificationService }
}

describe('ComplaintAppealService', () => {
  it('opens and links a complaint case on first report', async () => {
    const { riskRepo, service, agent, messageRepo, notificationService } = setup()
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
    expect(result.case?.queue).toBe('COMPLAINT')
    expect(result.complaint?.status).toBe('LINKED')
    expect(result.complaint?.linked_case_id).toBe(result.case?.id ?? null)
    expect(result.complaint?.complaint_type).toBe('HARASSMENT_REPORT')

    const cases = await riskRepo.listCases({ limit: 20, cursor: undefined })
    expect(cases.items).toHaveLength(1)
    const targets = await riskRepo.listCaseTargets(cases.items[0]!.id)
    expect(targets[0]).toMatchObject({ target_type: 'message', target_id: message.id })

    const notifications = await notificationService.list('user-1', { limit: 20, cursor: undefined })
    expect(notifications.items.some((item) =>
      item.type === 'GOVERNANCE'
      && item.title === '你的骚扰举报已进入审核'
      && item.target_type === 'complaint_ticket')).toBe(true)
    expect(notifications.items.some((item) =>
      item.title === '你的骚扰举报已进入审核'
      && item.body?.includes('聊天室 live 对话')
      && item.body.includes(message.id))).toBe(true)
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

  it('finds and reopens an older matching case even after more than 200 newer cases exist', async () => {
    const { riskRepo, service, reviewService, agent, messageRepo } = setup()
    const message = await messageRepo.create({
      room_id: 'room-overflow',
      author_id: agent.id,
      body: 'aged target',
    })
    const original = await reviewService.openAutomatedCase({
      case_type: 'COMPLAINT',
      summary_text: 'Original complaint case',
      opened_reason: 'seeded',
      target: {
        case_id: '',
        target_type: 'message',
        target_id: message.id,
        channel: 'report',
      },
    })
    await reviewService.resolveCase(original.id, 'seeded_resolution')

    await new Promise((resolve) => setTimeout(resolve, 5))

    for (let i = 0; i < 250; i += 1) {
      await reviewService.openAutomatedCase({
        case_type: 'COMPLAINT',
        summary_text: `Newer complaint ${i}`,
        opened_reason: 'seeded_newer_case',
        target: {
          case_id: '',
          target_type: 'message',
          target_id: `message-newer-${i}`,
          channel: 'report',
        },
      })
    }

    const result = await service.createReport({
      reporter_user_id: 'user-overflow',
      target_type: 'message',
      target_id: message.id,
      reason_code: 'repeat_report',
    })

    expect(result.case?.id).toBe(original.id)

    const cases = await riskRepo.listCases({ limit: 300, cursor: undefined })
    expect(cases.items).toHaveLength(251)
  })

  it('links appeal requests into their own review case', async () => {
    const { riskRepo, service, agent, postRepo, notificationService } = setup()
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
      requester_type: 'OWNER',
      target_type: 'post',
      target_id: post.id,
      appeal_type: 'CONTENT_APPEAL',
      reason: 'this should be reviewed again',
    })

    expect(result.appeal?.status).toBe('LINKED')
    expect(result.case?.case_type).toBe('APPEAL')
    expect(result.case?.queue).toBe('APPEAL')
    expect(result.appeal?.linked_case_id).toBe(result.case?.id ?? null)
    expect(result.appeal?.requester_type).toBe('OWNER')
    expect(result.appeal?.appeal_type).toBe('CONTENT_APPEAL')

    const appeals = await riskRepo.listAppealRequests({ limit: 20, cursor: undefined })
    expect(appeals.items).toHaveLength(1)

    const notifications = await notificationService.list('user-3', { limit: 20, cursor: undefined })
    expect(notifications.items.some((item) =>
      item.type === 'GOVERNANCE'
      && item.title === '你的内容申诉已进入复核'
      && item.target_type === 'appeal_request')).toBe(true)
    expect(notifications.items.some((item) =>
      item.title === '你的内容申诉已进入复核'
      && item.body?.includes('帖子详情页')
      && item.body.includes(post.id))).toBe(true)
  })

  it('stores typed privacy requests with attachments', async () => {
    const { riskRepo, service, agent, postRepo } = setup()
    const post = await postRepo.create({
      community_id: 'community-privacy',
      author_agent_id: agent.id,
      title: 'Needs privacy review',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    const result = await service.createComplaint({
      reporter_user_id: 'user-privacy',
      target_type: 'post',
      target_id: post.id,
      complaint_type: 'PRIVACY_REQUEST',
      detail_text: 'contains personal data',
      attachments: [{ ref: 'evidence://privacy-1', type: 'screenshot' }],
    })

    expect(result.complaint?.complaint_type).toBe('PRIVACY_REQUEST')
    expect(result.complaint?.reason_code).toBe('privacy_request')
    expect(result.complaint?.attachments).toEqual([{ ref: 'evidence://privacy-1', type: 'screenshot' }])
    expect(result.case?.queue).toBe('PRIVACY')
    expect(result.case?.priority).toBe(95)

    const evidence = await riskRepo.listEvidenceSnapshots(result.case!.id)
    const complaintEvidence = evidence.find((item) => item.snapshot_type === 'complaint_ticket')
    expect(complaintEvidence?.content).toEqual({
      detail_text: 'contains personal data',
      attachments: [{ ref: 'evidence://privacy-1', type: 'screenshot' }],
    })
    expect(complaintEvidence?.context).toMatchObject({
      reporter_user_id: 'user-privacy',
      target_type: 'post',
      target_id: post.id,
    })
    expect(complaintEvidence?.policy_hits).toEqual({
      complaint_type: 'PRIVACY_REQUEST',
      reason_code: 'privacy_request',
    })
    expect(complaintEvidence?.action_history).toEqual({
      complaint_ticket_id: result.complaint?.id,
    })
  })

  it('validates linked complaint ticket ids when creating appeals', async () => {
    const { service, agent, postRepo } = setup()
    const post = await postRepo.create({
      community_id: 'community-linked-complaint',
      author_agent_id: agent.id,
      title: 'Appeal target',
      body: 'body',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    })

    await expect(service.createAppeal({
      requester_user_id: 'user-4',
      target_type: 'post',
      target_id: post.id,
      appeal_type: 'CONTENT_APPEAL',
      reason: 'please revisit',
      linked_complaint_ticket_id: 'missing-complaint',
    })).rejects.toThrow('ComplaintTicket')
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

  it('accepts owned private-session reports and rejects sessions owned by another user', async () => {
    const privateSessionLookup = vi.fn(async (sessionId: string) => {
      if (sessionId === 'session-owned') {
        return { id: sessionId, human_user_id: 'user-private' }
      }
      if (sessionId === 'session-other') {
        return { id: sessionId, human_user_id: 'other-user' }
      }
      return null
    })
    const { service, notificationService } = setup({ privateSessionLookup })

    const result = await service.createComplaint({
      reporter_user_id: 'user-private',
      target_type: 'private_session',
      target_id: 'session-owned',
      complaint_type: 'HARASSMENT_REPORT',
      reason_code: 'private_session_report',
      detail_text: 'unsolicited direct outreach',
    })

    expect(result.complaint?.status).toBe('LINKED')
    expect(result.case?.primary_target_type).toBe('private_session')
    expect(result.case?.primary_target_id).toBe('session-owned')

    const notifications = await notificationService.list('user-private', { limit: 20, cursor: undefined })
    expect(notifications.items.some((item) =>
      item.type === 'GOVERNANCE'
      && item.title === '你的骚扰举报已进入审核')).toBe(true)
    expect(notifications.items.some((item) =>
      item.title === '你的骚扰举报已进入审核'
      && item.body?.includes('私聊会话')
      && item.body.includes('session-owned'))).toBe(true)

    await expect(service.createComplaint({
      reporter_user_id: 'user-private',
      target_type: 'private_session',
      target_id: 'session-other',
      complaint_type: 'HARASSMENT_REPORT',
      reason_code: 'private_session_report',
    })).rejects.toThrow('Not your private session')

    await expect(service.createComplaint({
      reporter_user_id: 'user-private',
      target_type: 'private_session',
      target_id: 'session-missing',
      complaint_type: 'HARASSMENT_REPORT',
      reason_code: 'private_session_report',
    })).rejects.toThrow('PrivateSession')
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
