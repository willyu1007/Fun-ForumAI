import type {
  AgentRepository,
  CommentRepository,
  MessageRepository,
  PostRepository,
} from '../repos/index.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'
import type { ReviewService } from './review-service.js'

const REPORTABLE_TARGET_TYPES = new Set([
  'post',
  'comment',
  'message',
  'agent',
  'config_revision',
])

type ReportableTargetType = 'post' | 'comment' | 'message' | 'agent' | 'config_revision'

export interface ComplaintAppealServiceDeps {
  postRepo: PostRepository
  commentRepo: CommentRepository
  messageRepo: MessageRepository
  agentRepo: AgentRepository
}

export class ComplaintAppealService {
  constructor(
    private readonly riskRepo: RiskGovernanceRepository,
    private readonly reviewService: ReviewService,
    private readonly deps?: ComplaintAppealServiceDeps,
  ) {}

  private normalizeTargetType(targetType: string): ReportableTargetType {
    const normalized = targetType.trim().toLowerCase()
    if (!REPORTABLE_TARGET_TYPES.has(normalized)) {
      throw new ValidationError('target_type must be one of: post, comment, message, agent, config_revision')
    }
    return normalized as ReportableTargetType
  }

  private async assertTargetExists(targetType: ReportableTargetType, targetId: string): Promise<void> {
    if (!this.deps) return

    if (targetType === 'post') {
      const post = await this.deps.postRepo.findById(targetId)
      if (!post) throw new NotFoundError('Post', targetId)
      return
    }
    if (targetType === 'comment') {
      const comment = await this.deps.commentRepo.findById(targetId)
      if (!comment) throw new NotFoundError('Comment', targetId)
      return
    }
    if (targetType === 'message') {
      const message = await this.deps.messageRepo.findById(targetId)
      if (!message) throw new NotFoundError('Message', targetId)
      return
    }
    if (targetType === 'agent' || targetType === 'config_revision') {
      const agent = this.deps.agentRepo.findById(targetId)
      if (!agent) throw new NotFoundError('Agent', targetId)
    }
  }

  private async findExistingCaseByTarget(targetType: string, targetId: string) {
    return this.riskRepo.findLatestCaseByTarget(targetType, targetId)
  }

  async createReport(input: {
    reporter_user_id: string
    target_type: string
    target_id: string
    reason_code: string
    detail_text?: string | null
  }) {
    const target_type = this.normalizeTargetType(input.target_type)
    await this.assertTargetExists(target_type, input.target_id)

    const complaint = await this.riskRepo.createComplaintTicket({
      ...input,
      target_type,
    })
    const existing = await this.findExistingCaseByTarget(target_type, input.target_id)

    const linkedCase = existing
      ? await this.reviewService.reopenCase(existing.id, 'complaint_reopen')
      : await this.reviewService.openAutomatedCase({
          case_type: 'COMPLAINT',
          priority: 85,
          summary_text: `Complaint on ${target_type}:${input.target_id}`,
          opened_reason: input.reason_code,
          opened_by: input.reporter_user_id,
          linked_complaint_ticket_id: complaint.id,
          target: {
            case_id: '',
            target_type,
            target_id: input.target_id,
            channel: 'report',
            user_id: input.reporter_user_id,
          },
          evidence: [{
            case_id: '',
            snapshot_type: 'complaint_ticket',
            payload: {
              reason_code: input.reason_code,
              detail_text: input.detail_text ?? null,
            },
          }],
        })

    if (linkedCase) {
      await this.riskRepo.updateComplaintTicket(complaint.id, {
        status: 'LINKED',
        linked_case_id: linkedCase.id,
      })
    }

    return {
      complaint: await this.riskRepo.findComplaintTicketById(complaint.id),
      case: linkedCase,
    }
  }

  async createAppeal(input: {
    requester_user_id: string
    target_type: string
    target_id: string
    reason: string
  }) {
    const target_type = this.normalizeTargetType(input.target_type)
    await this.assertTargetExists(target_type, input.target_id)

    const appeal = await this.riskRepo.createAppealRequest({
      ...input,
      target_type,
    })
    const linkedCase = await this.reviewService.openAutomatedCase({
      case_type: 'APPEAL',
      priority: 80,
      summary_text: `Appeal on ${target_type}:${input.target_id}`,
      opened_reason: 'appeal_submitted',
      opened_by: input.requester_user_id,
      linked_appeal_request_id: appeal.id,
      target: {
        case_id: '',
        target_type,
        target_id: input.target_id,
        channel: 'appeal',
        user_id: input.requester_user_id,
      },
      evidence: [{
        case_id: '',
        snapshot_type: 'appeal_request',
        payload: { reason: input.reason },
      }],
    })

    await this.riskRepo.updateAppealRequest(appeal.id, {
      status: 'LINKED',
      linked_case_id: linkedCase.id,
    })

    return {
      appeal: await this.riskRepo.findAppealRequestById(appeal.id),
      case: linkedCase,
    }
  }

  async listReportsForUser(input: {
    reporter_user_id: string
    status?: string
    cursor?: string
    limit?: number
  }) {
    return this.riskRepo.listComplaintTickets({
      reporter_user_id: input.reporter_user_id,
      status: input.status,
      cursor: input.cursor,
      limit: Math.min(input.limit ?? 50, 100),
    })
  }

  async listAppealsForUser(input: {
    requester_user_id: string
    status?: string
    cursor?: string
    limit?: number
  }) {
    return this.riskRepo.listAppealRequests({
      requester_user_id: input.requester_user_id,
      status: input.status,
      cursor: input.cursor,
      limit: Math.min(input.limit ?? 50, 100),
    })
  }
}
