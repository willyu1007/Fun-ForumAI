import type {
  AgentRepository,
  AppealRequesterType,
  AppealType,
  CommentRepository,
  ComplaintType,
  GovernanceAttachment,
  MessageRepository,
  PostRepository,
  ReviewQueue,
} from '../repos/index.js'
import type { PrivateSession } from '../repos/types.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'
import type { ReviewService } from './review-service.js'
import type { NotificationService } from './notification-service.js'

const REPORTABLE_TARGET_TYPES = new Set([
  'post',
  'comment',
  'message',
  'private_session',
  'agent',
  'config_revision',
])

const COMPLAINT_TYPES = new Set<ComplaintType>([
  'CONTENT_REPORT',
  'PRIVACY_REQUEST',
  'DELETION_REQUEST',
  'IMPERSONATION_REPORT',
  'MISLABEL_REPORT',
  'HARASSMENT_REPORT',
  'OTHER',
])

const APPEAL_TYPES = new Set<AppealType>([
  'CONTENT_APPEAL',
  'ACCOUNT_LIMIT_APPEAL',
  'AGENT_RESTRICTION_APPEAL',
  'OTHER',
])

const APPEAL_REQUESTER_TYPES = new Set<AppealRequesterType>([
  'USER',
  'OWNER',
  'OPERATOR',
])

type ReportableTargetType = 'post' | 'comment' | 'message' | 'private_session' | 'agent' | 'config_revision'

export interface ComplaintAppealServiceDeps {
  postRepo: PostRepository
  commentRepo: CommentRepository
  messageRepo: MessageRepository
  agentRepo: AgentRepository
}

type PrivateSessionLookup = (sessionId: string) => Promise<Pick<PrivateSession, 'id' | 'human_user_id'> | null>

export class ComplaintAppealService {
  private privateSessionLookup: PrivateSessionLookup | null = null

  constructor(
    private readonly riskRepo: RiskGovernanceRepository,
    private readonly reviewService: ReviewService,
    private readonly deps?: ComplaintAppealServiceDeps,
    private readonly notificationService: NotificationService | null = null,
  ) {}

  setPrivateSessionLookup(lookup: PrivateSessionLookup | null): void {
    this.privateSessionLookup = lookup
  }

  private async createGovernanceNotification(input: {
    user_id: string
    title: string
    body: string
    target_type: string
    target_id: string
  }) {
    if (!this.notificationService) return null
    return this.notificationService.create({
      userId: input.user_id,
      type: 'GOVERNANCE',
      title: input.title,
      body: input.body,
      targetType: input.target_type,
      targetId: input.target_id,
    })
  }

  private normalizeTargetType(targetType: string): ReportableTargetType {
    const normalized = targetType.trim().toLowerCase()
    if (!REPORTABLE_TARGET_TYPES.has(normalized)) {
      throw new ValidationError('target_type must be one of: post, comment, message, private_session, agent, config_revision')
    }
    return normalized as ReportableTargetType
  }

  private normalizeComplaintType(input: string | undefined, reasonCode: string | undefined): ComplaintType {
    if (input) {
      const normalized = input.trim().toUpperCase()
      if (!COMPLAINT_TYPES.has(normalized as ComplaintType)) {
        throw new ValidationError('complaint_type must be one of: CONTENT_REPORT, PRIVACY_REQUEST, DELETION_REQUEST, IMPERSONATION_REPORT, MISLABEL_REPORT, HARASSMENT_REPORT, OTHER')
      }
      return normalized as ComplaintType
    }

    const normalizedReason = reasonCode?.trim().toLowerCase() ?? ''
    if (normalizedReason.includes('privacy') || normalizedReason.includes('pii')) return 'PRIVACY_REQUEST'
    if (normalizedReason.includes('delete') || normalizedReason.includes('remove')) return 'DELETION_REQUEST'
    if (normalizedReason.includes('imperson')) return 'IMPERSONATION_REPORT'
    if (normalizedReason.includes('mislabel') || normalizedReason.includes('label')) return 'MISLABEL_REPORT'
    if (normalizedReason.includes('harass') || normalizedReason.includes('abuse')) return 'HARASSMENT_REPORT'
    return 'CONTENT_REPORT'
  }

  private normalizeAppealType(input: string | undefined): AppealType {
    const normalized = input?.trim().toUpperCase() ?? 'CONTENT_APPEAL'
    if (!APPEAL_TYPES.has(normalized as AppealType)) {
      throw new ValidationError('appeal_type must be one of: CONTENT_APPEAL, ACCOUNT_LIMIT_APPEAL, AGENT_RESTRICTION_APPEAL, OTHER')
    }
    return normalized as AppealType
  }

  private normalizeAppealRequesterType(input: string | undefined): AppealRequesterType {
    const normalized = input?.trim().toUpperCase() ?? 'USER'
    if (!APPEAL_REQUESTER_TYPES.has(normalized as AppealRequesterType)) {
      throw new ValidationError('requester_type must be one of: USER, OWNER, OPERATOR')
    }
    return normalized as AppealRequesterType
  }

  private normalizeReasonCode(input: string | undefined, complaintType: ComplaintType): string {
    const normalized = input?.trim()
    if (normalized) return normalized
    switch (complaintType) {
      case 'PRIVACY_REQUEST': return 'privacy_request'
      case 'DELETION_REQUEST': return 'deletion_request'
      case 'IMPERSONATION_REPORT': return 'impersonation_report'
      case 'MISLABEL_REPORT': return 'mislabel_report'
      case 'HARASSMENT_REPORT': return 'harassment_report'
      case 'OTHER': return 'other'
      case 'CONTENT_REPORT':
      default:
        return 'content_report'
    }
  }

  private normalizeAttachments(value: GovernanceAttachment[] | undefined): GovernanceAttachment[] {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is GovernanceAttachment =>
      Boolean(item)
      && typeof item.ref === 'string'
      && item.ref.trim().length > 0
      && typeof item.type === 'string'
      && item.type.trim().length > 0)
  }

  private complaintPriority(complaintType: ComplaintType): number {
    switch (complaintType) {
      case 'PRIVACY_REQUEST':
      case 'DELETION_REQUEST':
        return 95
      case 'IMPERSONATION_REPORT':
      case 'HARASSMENT_REPORT':
        return 90
      case 'MISLABEL_REPORT':
        return 82
      case 'OTHER':
        return 75
      case 'CONTENT_REPORT':
      default:
        return 85
    }
  }

  private complaintQueue(complaintType: ComplaintType): ReviewQueue {
    switch (complaintType) {
      case 'PRIVACY_REQUEST':
        return 'PRIVACY'
      case 'DELETION_REQUEST':
        return 'DELETION'
      case 'CONTENT_REPORT':
      case 'IMPERSONATION_REPORT':
      case 'MISLABEL_REPORT':
      case 'HARASSMENT_REPORT':
      case 'OTHER':
      default:
        return 'COMPLAINT'
    }
  }

  private appealPriority(appealType: AppealType): number {
    switch (appealType) {
      case 'ACCOUNT_LIMIT_APPEAL':
      case 'AGENT_RESTRICTION_APPEAL':
        return 85
      case 'OTHER':
        return 72
      case 'CONTENT_APPEAL':
      default:
        return 80
    }
  }

  private complaintNotificationTitle(complaintType: ComplaintType): string {
    switch (complaintType) {
      case 'PRIVACY_REQUEST':
        return '你的隐私请求已进入审核'
      case 'DELETION_REQUEST':
        return '你的删除请求已进入审核'
      case 'IMPERSONATION_REPORT':
        return '你的冒充举报已进入审核'
      case 'MISLABEL_REPORT':
        return '你的误标举报已进入审核'
      case 'HARASSMENT_REPORT':
        return '你的骚扰举报已进入审核'
      case 'OTHER':
        return '你的投诉已进入审核'
      case 'CONTENT_REPORT':
      default:
        return '你的举报已进入审核'
    }
  }

  private targetLabel(targetType: ReportableTargetType, targetId: string): string {
    const base = targetType === 'post'
      ? '论坛帖子'
      : targetType === 'comment'
        ? '评论区回复'
        : targetType === 'message'
          ? '聊天室发言'
          : targetType === 'private_session'
            ? '私聊会话'
            : targetType === 'agent'
              ? '智能体主页'
              : '配置修订'
    return `${base} · ${targetId}`
  }

  private complaintSurfaceLabel(targetType: ReportableTargetType, reasonCode: string): string {
    const normalized = reasonCode.trim().toLowerCase()
    if (normalized === 'comment_report') return '评论区'
    if (normalized === 'chat_message_report') return '聊天室 live 对话'
    if (normalized === 'proactive_private_session_report') return '主动私信会话'
    if (normalized === 'proactive_outreach_report') return '通知中心的主动私信提醒'
    if (normalized === 'private_session_report') return '私聊会话'
    if (normalized === 'privacy_request') return '隐私请求入口'
    if (normalized === 'deletion_request') return '删除请求入口'
    if (normalized === 'impersonation_report') return '冒充举报入口'
    if (normalized === 'mislabel_report') return '误标举报入口'
    if (normalized === 'harassment_report') return '骚扰举报入口'

    return targetType === 'post'
      ? '帖子详情页'
      : targetType === 'comment'
        ? '评论区'
        : targetType === 'message'
          ? '聊天室 live 对话'
          : targetType === 'private_session'
            ? '私聊会话'
            : targetType === 'agent'
              ? '智能体主页'
              : '配置审核页'
  }

  private appealSurfaceLabel(targetType: ReportableTargetType): string {
    return targetType === 'post'
      ? '帖子详情页'
      : targetType === 'comment'
        ? '评论区'
        : targetType === 'message'
          ? '聊天室 live 对话'
          : targetType === 'private_session'
            ? '私聊会话'
            : targetType === 'agent'
              ? '智能体主页'
              : '配置审核页'
  }

  private complaintNotificationBody(input: {
    complaintType: ComplaintType
    linkedCaseId: string
    queue: ReviewQueue
    targetType: ReportableTargetType
    targetId: string
    reasonCode: string
  }): string {
    const queueLabel = input.queue === 'PRIVACY'
      ? '隐私队列'
      : input.queue === 'DELETION'
        ? '删除队列'
        : '投诉队列'
    return `提交入口 ${this.complaintSurfaceLabel(input.targetType, input.reasonCode)} · 目标对象 ${this.targetLabel(input.targetType, input.targetId)} · case ${input.linkedCaseId} · 已进入${queueLabel}`
  }

  private appealNotificationTitle(appealType: AppealType): string {
    switch (appealType) {
      case 'ACCOUNT_LIMIT_APPEAL':
        return '你的账号限制申诉已进入复核'
      case 'AGENT_RESTRICTION_APPEAL':
        return '你的智能体限制申诉已进入复核'
      case 'OTHER':
        return '你的申诉已进入复核'
      case 'CONTENT_APPEAL':
      default:
        return '你的内容申诉已进入复核'
    }
  }

  private appealNotificationBody(input: {
    appealType: AppealType
    linkedCaseId: string
    targetType: ReportableTargetType
    targetId: string
  }): string {
    return `复核入口 ${this.appealSurfaceLabel(input.targetType)} · 目标对象 ${this.targetLabel(input.targetType, input.targetId)} · case ${input.linkedCaseId} · 已进入申诉复核队列`
  }

  private async assertTargetExists(targetType: ReportableTargetType, targetId: string, actorUserId?: string): Promise<void> {
    if (targetType === 'private_session') {
      if (!this.privateSessionLookup) return
      const session = await this.privateSessionLookup(targetId)
      if (!session) throw new NotFoundError('PrivateSession', targetId)
      if (actorUserId && session.human_user_id !== actorUserId) {
        throw new ForbiddenError('Not your private session')
      }
      return
    }

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

  async createComplaint(input: {
    reporter_user_id: string
    target_type: string
    target_id: string
    complaint_type?: string
    reason_code?: string
    detail_text?: string | null
    attachments?: GovernanceAttachment[]
  }) {
    const target_type = this.normalizeTargetType(input.target_type)
    const complaint_type = this.normalizeComplaintType(input.complaint_type, input.reason_code)
    const reason_code = this.normalizeReasonCode(input.reason_code, complaint_type)
    const attachments = this.normalizeAttachments(input.attachments)
    await this.assertTargetExists(target_type, input.target_id, input.reporter_user_id)

    const complaint = await this.riskRepo.createComplaintTicket({
      target_type,
      reporter_user_id: input.reporter_user_id,
      target_id: input.target_id,
      complaint_type,
      reason_code,
      detail_text: input.detail_text,
      attachments,
    })
    const linkedCase = await this.reviewService.ensureCase({
      case_type: 'COMPLAINT',
      queue: this.complaintQueue(complaint_type),
      priority: this.complaintPriority(complaint_type),
      summary_text: `Complaint ${complaint_type} on ${target_type}:${input.target_id}`,
      risk_summary: {
        source: 'complaint_ticket',
        complaint_type,
        reason_code,
      },
      opened_reason: reason_code,
      opened_by: input.reporter_user_id,
      linked_complaint_ticket_id: complaint.id,
      target: {
        case_id: '',
        target_type,
        target_id: input.target_id,
        relation_type: 'PRIMARY',
        channel: 'report',
        user_id: input.reporter_user_id,
      },
      evidence: [{
        case_id: '',
        snapshot_type: 'complaint_ticket',
        payload: {
          complaint_type,
          reason_code,
          detail_text: input.detail_text ?? null,
          attachments,
        },
        content: {
          detail_text: input.detail_text ?? null,
          attachments,
        },
        context: {
          reporter_user_id: input.reporter_user_id,
          target_type,
          target_id: input.target_id,
        },
        policy_hits: {
          complaint_type,
          reason_code,
        },
        action_history: {
          complaint_ticket_id: complaint.id,
        },
      }],
    })

    if (linkedCase) {
      await this.riskRepo.updateComplaintTicket(complaint.id, {
        status: 'LINKED',
        linked_case_id: linkedCase.id,
      })
      await this.createGovernanceNotification({
        user_id: input.reporter_user_id,
        title: this.complaintNotificationTitle(complaint_type),
        body: this.complaintNotificationBody({
          complaintType: complaint_type,
          linkedCaseId: linkedCase.id,
          queue: linkedCase.queue,
          targetType: target_type,
          targetId: input.target_id,
          reasonCode: reason_code,
        }),
        target_type: 'complaint_ticket',
        target_id: complaint.id,
      })
    }

    await this.reviewService.logGovernanceAction({
      case_id: linkedCase?.id ?? null,
      action: 'complaint_ticket_created',
      target_type,
      target_id: input.target_id,
      actor_user_id: input.reporter_user_id,
      reason: reason_code,
      result: {
        complaint_id: complaint.id,
        complaint_type,
        linked_case_id: linkedCase?.id ?? null,
      },
    })

    return {
      complaint: await this.riskRepo.findComplaintTicketById(complaint.id),
      case: linkedCase,
    }
  }

  async createAppeal(input: {
    requester_user_id: string
    requester_type?: string
    target_type: string
    target_id: string
    appeal_type?: string
    reason: string
    linked_complaint_ticket_id?: string | null
  }) {
    const target_type = this.normalizeTargetType(input.target_type)
    const requester_type = this.normalizeAppealRequesterType(input.requester_type)
    const appeal_type = this.normalizeAppealType(input.appeal_type)
    await this.assertTargetExists(target_type, input.target_id, input.requester_user_id)
    if (input.linked_complaint_ticket_id) {
      const linkedComplaint = await this.riskRepo.findComplaintTicketById(input.linked_complaint_ticket_id)
      if (!linkedComplaint) {
        throw new NotFoundError('ComplaintTicket', input.linked_complaint_ticket_id)
      }
    }

    const appeal = await this.riskRepo.createAppealRequest({
      requester_user_id: input.requester_user_id,
      requester_type,
      target_type,
      target_id: input.target_id,
      appeal_type,
      reason: input.reason,
      linked_complaint_ticket_id: input.linked_complaint_ticket_id ?? null,
    })
    const linkedCase = await this.reviewService.ensureCase({
      case_type: 'APPEAL',
      queue: 'APPEAL',
      priority: this.appealPriority(appeal_type),
      summary_text: `Appeal ${appeal_type} on ${target_type}:${input.target_id}`,
      risk_summary: {
        source: 'appeal_request',
        appeal_type,
        requester_type,
      },
      opened_reason: 'appeal_submitted',
      opened_by: input.requester_user_id,
      linked_appeal_request_id: appeal.id,
      linked_complaint_ticket_id: input.linked_complaint_ticket_id ?? null,
      target: {
        case_id: '',
        target_type,
        target_id: input.target_id,
        relation_type: 'PRIMARY',
        channel: 'appeal',
        user_id: input.requester_user_id,
      },
      evidence: [{
        case_id: '',
        snapshot_type: 'appeal_request',
        payload: {
          requester_type,
          appeal_type,
          reason: input.reason,
          linked_complaint_ticket_id: input.linked_complaint_ticket_id ?? null,
        },
        content: {
          reason: input.reason,
        },
        context: {
          requester_user_id: input.requester_user_id,
          target_type,
          target_id: input.target_id,
          linked_complaint_ticket_id: input.linked_complaint_ticket_id ?? null,
        },
        policy_hits: {
          requester_type,
          appeal_type,
        },
        action_history: {
          appeal_request_id: appeal.id,
        },
      }],
      reopen_existing: false,
    })

    await this.riskRepo.updateAppealRequest(appeal.id, {
      status: 'LINKED',
      linked_case_id: linkedCase.id,
      linked_complaint_ticket_id: input.linked_complaint_ticket_id ?? null,
      result: {
        linked_case_id: linkedCase.id,
      },
    })
    await this.createGovernanceNotification({
      user_id: input.requester_user_id,
      title: this.appealNotificationTitle(appeal_type),
      body: this.appealNotificationBody({
        appealType: appeal_type,
        linkedCaseId: linkedCase.id,
        targetType: target_type,
        targetId: input.target_id,
      }),
      target_type: 'appeal_request',
      target_id: appeal.id,
    })

    await this.reviewService.logGovernanceAction({
      case_id: linkedCase.id,
      action: 'appeal_request_created',
      target_type,
      target_id: input.target_id,
      actor_user_id: input.requester_user_id,
      reason: input.reason,
      result: {
        appeal_id: appeal.id,
        appeal_type,
        requester_type,
      },
    })

    return {
      appeal: await this.riskRepo.findAppealRequestById(appeal.id),
      case: linkedCase,
    }
  }

  async createReport(input: {
    reporter_user_id: string
    target_type: string
    target_id: string
    reason_code: string
    detail_text?: string | null
    attachments?: GovernanceAttachment[]
  }) {
    return this.createComplaint(input)
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
